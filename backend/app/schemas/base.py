from pydantic import BaseModel, ConfigDict

class BaseSchema(BaseModel):
    """Base schema that enables ORM serialization compatibility (Pydantic v2 from_attributes)."""
    model_config = ConfigDict(from_attributes=True)
