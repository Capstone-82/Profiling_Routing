import json
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from app.schemas import ModelSchema

MAPPING_FILE = Path(__file__).parent / "routing" / "bedrock_model_mapping.json"

class ModelMappingService:
    """Service to map between router-friendly model IDs and Bedrock Foundation Model IDs."""

    def __init__(self, mapping_path: Optional[Path] = None):
        self.mapping_path = mapping_path or MAPPING_FILE
        self._load()

    def _load(self):
        if not self.mapping_path.exists():
            self.friendly_to_bedrock: Dict[str, str] = {}
            self.bedrock_to_friendly: Dict[str, str] = {}
            self.catalog: List[Dict[str, Any]] = []
            return

        with open(self.mapping_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            self.friendly_to_bedrock = data.get("friendly_to_bedrock", {})
            self.bedrock_to_friendly = data.get("bedrock_to_friendly", {})
            self.catalog = data.get("allowed_bedrock_catalog", [])

    def get_bedrock_id(self, friendly_id: str) -> Optional[str]:
        """Convert a router friendly ID (e.g. 'claude-sonnet-5') to Bedrock model ID."""
        return self.friendly_to_bedrock.get(friendly_id)

    def get_friendly_id(self, bedrock_model_id: str) -> Optional[str]:
        """Convert a Bedrock model ID (e.g. 'anthropic.claude-3-5-sonnet-20241022-v2:0') to friendly ID."""
        if bedrock_model_id in self.bedrock_to_friendly:
            return self.bedrock_to_friendly[bedrock_model_id]

        # Fuzzy matching fallback for version suffixes if exact match fails
        bedrock_clean = bedrock_model_id.lower()
        if "claude-3-5-sonnet" in bedrock_clean or "claude-sonnet-3-5" in bedrock_clean:
            return "claude-sonnet-5"
        if "claude-3-5-haiku" in bedrock_clean:
            return "claude-haiku-4-5-20251001"
        if "claude-3-opus" in bedrock_clean:
            return "claude-opus-5"
        if "claude-3-haiku" in bedrock_clean:
            return "claude-3-haiku"
        if "nova-pro" in bedrock_clean:
            return "amazon-nova-pro"
        if "nova-lite" in bedrock_clean:
            return "amazon-nova-lite"
        if "nova-micro" in bedrock_clean:
            return "amazon-nova-micro"
        if "nova-premier" in bedrock_clean:
            return "amazon-nova-premier"
        if "llama3-3-70b" in bedrock_clean:
            return "llama-3.3-70b"
        if "llama3-1-70b" in bedrock_clean:
            return "llama-4-maverick"
        if "llama3-1-8b" in bedrock_clean:
            return "llama-4-scout"
        if "mistral-large" in bedrock_clean:
            return "mistral-large-3"
        if "mistral-small" in bedrock_clean:
            return "mistral-small"

        return None

    def get_allowed_catalog(self) -> List[ModelSchema]:
        """Get the hardcoded, maintained allowed Bedrock model list."""
        results = []
        for idx, item in enumerate(self.catalog):
            results.append(
                ModelSchema(
                    id=item.get("id", f"model-{idx+1}"),
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

    def intersect_candidates(
        self,
        user_selected_friendly_or_bedrock_ids: Optional[List[str]],
        connected_bedrock_model_ids: List[str],
        allow_listed_friendly_ids: Optional[List[str]] = None,
    ) -> Tuple[List[str], List[str]]:
        """
        Calculates the allowed router-friendly candidate list.
        Returns: (candidate_friendly_ids, warnings)
        """
        warnings = []
        
        # 1. Map connected Bedrock models to friendly IDs
        connected_friendly = set()
        for b_id in connected_bedrock_model_ids:
            f_id = self.get_friendly_id(b_id)
            if f_id:
                connected_friendly.add(f_id)

        # 2. Intersect with governance allow-list (if defined)
        if allow_listed_friendly_ids is not None and len(allow_listed_friendly_ids) > 0:
            gov_allowed = set(allow_listed_friendly_ids)
            candidates = connected_friendly.intersection(gov_allowed)
        else:
            candidates = set(connected_friendly)

        # 3. Intersect with user selection (if user selected a specific subset in the playground)
        if user_selected_friendly_or_bedrock_ids and len(user_selected_friendly_or_bedrock_ids) > 0:
            user_friendly = set()
            for id_str in user_selected_friendly_or_bedrock_ids:
                # Could be friendly_id or providerModelId or catalog id
                if id_str in self.friendly_to_bedrock:
                    user_friendly.add(id_str)
                else:
                    mapped = self.get_friendly_id(id_str)
                    if mapped:
                        user_friendly.add(mapped)
                    else:
                        # Check catalog id
                        for c in self.catalog:
                            if c.get("id") == id_str:
                                user_friendly.add(c["friendly_id"])
                                break
            
            if user_friendly:
                candidates = candidates.intersection(user_friendly)

        if not candidates:
            # If intersection is empty, fallback to connected_friendly or all catalog friendly
            warnings.append("No models survived the intersection of user selection, governance allow-list, and Bedrock enabled models.")

        return list(candidates), warnings


model_mapping_service = ModelMappingService()
