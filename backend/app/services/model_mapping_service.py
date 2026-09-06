import json
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from app.schemas import ModelSchema

MAPPING_FILE = Path(__file__).parent / "routing" / "bedrock_model_mapping.json"

class ModelMappingService:
    """Service to map between router model IDs and Bedrock Foundation Model IDs."""

    def __init__(self, mapping_path: Optional[Path] = None):
        self.mapping_path = mapping_path or MAPPING_FILE
        self._load()

    def _load(self):
        if not self.mapping_path.exists():
            self.router_to_bedrock: Dict[str, str] = {}
            self.bedrock_to_router: Dict[str, str] = {}
            self.catalog: List[Dict[str, Any]] = []
            return

        with open(self.mapping_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            self.router_to_bedrock = data.get("router_to_bedrock", {})
            self.bedrock_to_router = data.get("bedrock_to_router", {})
            self.catalog = data.get("allowed_bedrock_catalog", [])

    def get_bedrock_id(self, router_model_id: str) -> Optional[str]:
        """Convert a router model ID (e.g. 'anthropic-claude-3-5-sonnet-v2') to Bedrock model ID."""
        if not router_model_id:
            return None
        if router_model_id in self.router_to_bedrock:
            return self.router_to_bedrock[router_model_id]
        # If it's already a Bedrock ID
        if router_model_id in self.bedrock_to_router:
            return router_model_id
        for c in self.catalog:
            if c.get("router_model_id") == router_model_id:
                return c.get("providerModelId")
            if c.get("providerModelId") == router_model_id:
                return c.get("providerModelId")
        return None

    def get_router_id(self, bedrock_model_id: str) -> Optional[str]:
        """Convert a Bedrock model ID (e.g. 'anthropic.claude-3-5-sonnet-20241022-v2:0') to router model ID."""
        if not bedrock_model_id:
            return None
        if bedrock_model_id in self.bedrock_to_router:
            return self.bedrock_to_router[bedrock_model_id]
        if bedrock_model_id in self.router_to_bedrock:
            return bedrock_model_id

        # Normalize prefix if present (e.g. us. / eu.)
        clean_id = bedrock_model_id
        if clean_id.startswith(("us.", "eu.", "ap.", "global.")):
            clean_id = clean_id.split(".", 1)[1]
            if clean_id in self.bedrock_to_router:
                return self.bedrock_to_router[clean_id]

        for c in self.catalog:
            if c.get("providerModelId") == bedrock_model_id or c.get("providerModelId") == clean_id:
                return c.get("router_model_id")

        return None

    # Backward compatibility alias
    def get_friendly_id(self, bedrock_model_id: str) -> Optional[str]:
        return self.get_router_id(bedrock_model_id)

    def to_router_id(self, model_id_str: str) -> Optional[str]:
        """Convert any model ID string (bedrock or router) to canonical router_model_id."""
        return self.get_router_id(model_id_str)

    def to_router_ids(self, bedrock_ids: List[str]) -> List[str]:
        """Convert a list of Bedrock model IDs to unique router_model_ids."""
        router_ids = []
        for b_id in bedrock_ids:
            r_id = self.get_router_id(b_id)
            if r_id and r_id not in router_ids:
                router_ids.append(r_id)
        return router_ids

    def to_bedrock_ids(self, router_ids: List[str]) -> List[str]:
        """Convert a list of router model IDs to unique Bedrock model IDs."""
        bedrock_ids = []
        for r_id in router_ids:
            b_id = self.get_bedrock_id(r_id)
            if b_id and b_id not in bedrock_ids:
                bedrock_ids.append(b_id)
        return bedrock_ids

    def get_display_name(self, model_id_str: str) -> str:
        """Lookup human-readable display name for any Bedrock or router model ID."""
        for c in self.catalog:
            if (
                c.get("providerModelId") == model_id_str
                or c.get("router_model_id") == model_id_str
                or c.get("id") == model_id_str
            ):
                return c.get("name", model_id_str)

        # Clean fallback
        clean_id = model_id_str.split(":")[-1] if ":" in model_id_str else model_id_str
        return clean_id.replace("anthropic.", "").replace("amazon.", "").replace("meta.", "").replace("mistral.", "").replace("-", " ").title()

    def get_allowed_catalog(self) -> List[ModelSchema]:
        """Get the hardcoded, maintained allowed Bedrock model list."""
        results = []
        for idx, item in enumerate(self.catalog):
            results.append(
                ModelSchema(
                    id=item.get("providerModelId", f"model-{idx+1}"),
                    name=item["name"],
                    provider=item["provider"],
                    providerModelId=item["providerModelId"],
                    contextWindow=item.get("contextWindow", "128K tokens"),
                    category=item.get("category", "General"),
                    inputModalities=["TEXT"],
                    outputModalities=["TEXT"],
                    responseStreamingSupported=True,
                )
            )
        return results


model_mapping_service = ModelMappingService()
