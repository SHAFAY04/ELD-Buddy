from datetime import datetime
from pydantic import BaseModel, Field

class LocationDto(BaseModel):
    lng:float = Field(...,description="Latitude coordinate", ge=-90, le=90)
    lat:float = Field(...,description="Longitude coordinate", ge=-180, le=180)


class CalculateTripRequestDto(BaseModel):
    trip_start_time: datetime = Field(..., description="Starting time")
    start: LocationDto = Field(..., description="Starting pickup location coordinates")
    dropoff: LocationDto= Field(..., description="Dropoff location coordinates")
    currentCycleHours: float = Field(
        default=0.0, 
        ge=0.0, 
        le=70.0, 
        description="Hours of service cycle used so far"
    )