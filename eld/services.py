

import datetime
import math
from eld.schema import CalculateTripRequestDto
import requests
from datetime import datetime, timedelta

class EldService:

    @staticmethod
    def calculate_trip(dto:CalculateTripRequestDto):

        start_time=dto.trip_start_time
        start_lat=dto.start.lat
        start_lng=dto.start.lng
        end_lat=dto.dropoff.lat
        end_lng=dto.dropoff.lng
        cycle_hours= dto.currentCycleHours

        osrm_url = f"http://router.project-osrm.org/route/v1/driving/{start_lng},{start_lat};{end_lng},{end_lat}?overview=full&geometries=geojson&annotations=duration,distance"

        response = requests.get(osrm_url)
        route_data = response.json()

        total_distance_meters = route_data["routes"][0]["distance"]
        total_distance_miles = total_distance_meters * 0.000621371

        total_duration_seconds = route_data["routes"][0]["duration"]
        total_duration_hours = total_duration_seconds / 3600

        # WHICH CORDINATE TO FUEL AT.
        distance_from_start = 0
        fuel_cordinates = [0, 0]

        if total_distance_miles > 1000:
            for i in range(len(route_data["routes"][0]["legs"][0]["annotation"]["distance"])):
                distance_from_start = distance_from_start + route_data["routes"][0]["legs"][0]["annotation"]["distance"][i]

                # checking if the distance is now 1000 miles
                if distance_from_start >= 1609344:
                    fuel_cordinates = route_data["routes"][0]["geometry"]["coordinates"][i]

                    # now that we have the fueling cordinate we can break the loop
                    break

        # WHICH CORDINATE TO TAKE THE HALF HOUR BREAK ON.
        time_from_start = 0
        break_cordinates = [0, 0]

        if total_duration_hours > 8:
            for i in range(len(route_data["routes"][0]["legs"][0]["annotation"]["duration"])):
                time_from_start = time_from_start + route_data["routes"][0]["legs"][0]["annotation"]["duration"][i]

                # checking if the time is now 8 hours basically 28800 seconds
                if time_from_start >= 28800:
                    break_cordinates = route_data["routes"][0]["geometry"]["coordinates"][i]

                    # now that we have the break cordinate we can break the loop
                    break

        # WHICH COORDINATE TO TAKE THE DAY OFF.
        time_from_start_day_off = 0
        day_off_cordinates = [0, 0]

        if total_duration_hours > 11:
            for i in range(len(route_data["routes"][0]["legs"][0]["annotation"]["duration"])):
                time_from_start_day_off = time_from_start_day_off + route_data["routes"][0]["legs"][0]["annotation"]["duration"][i]

                # checking if the time is now 11 hours basically 39600 seconds
                if time_from_start_day_off >= 39600:
                    day_off_cordinates = route_data["routes"][0]["geometry"]["coordinates"][i]

                    # now that we have the day off coordinate we can break the loop
                    break


        #for leaftlet map we need cordinates to create a complete path
        #we already have breaks and day off cordinates from above code
        #we will also return total time in hours so that frontend can map the log lines accordingly if trip takes more than 24 hours then a new log
        coordinates_lng_lat = route_data["routes"][0]["geometry"]["coordinates"]
        leaflet_lat_lng = [[lat, lng] for lng, lat in coordinates_lng_lat]

        #we also need to prepare and return the whole timeline for eld log
        days=total_duration_hours/11
        logs_to_create=math.ceil(days)

        log_objects=[]

        #log variables keeping off duty mandatory here because we dont want to reset it and 
        #and its persisted value is needed by all iterations
        off_duty_mandatory=0
        #we also want a trip time variable might need it
        trip_time_elapsed=0
        for i in range(logs_to_create):

            #for the first day log we wanna add 1 hour for cargo loading
            if(i==0):
                on_duty_loading=start_time+ timedelta(hours=1)

                #if they can do it within 8 hours no resting required small day
                if(total_duration_hours<8):
                    on_duty_driving= on_duty_loading+timedelta(hours=total_duration_hours)
                    on_duty_offloading=on_duty_driving+ timedelta(hours=1)
                    log_objects.append({
                        "on_duty_loading": on_duty_loading,
                        "on_duty_driving": on_duty_driving,
                        "on_duty_offloading": on_duty_offloading
                    })
                else:
                    on_duty_driving= on_duty_loading+timedelta(hours=8)
                    trip_time_elapsed=8
                    break_after_driving=on_duty_driving+timedelta(minutes=30)
                    driving_after_break=break_after_driving+timedelta(hours=3)
                    trip_time_elapsed=trip_time_elapsed+3 #only 11 hours trip done yet
                    off_duty_mandatory=driving_after_break+timedelta(hours=10)
                    log_objects.append({
                        #if its 7am it becomes 8am
                        "on_duty_loading": on_duty_loading,
                        "on_duty_driving":on_duty_driving,
                        "break_after_driving":break_after_driving,
                        "driving_after_break":driving_after_break,
                        "off_duty_mandatory":off_duty_mandatory
                    })
            
            #for the last day log we wanna add 1 hour for cargo offloading
            elif(i==logs_to_create-1):
                #now that its the last day we wanna only drive till we reach the destination
                hours_left_to_destination=total_duration_hours-trip_time_elapsed
                on_duty_driving=off_duty_mandatory+timedelta(hours=hours_left_to_destination)
                on_duty_offloading=on_duty_driving+ timedelta(hours=1)
                log_objects.append({
                    "on_duty_driving":on_duty_driving,
                    "on_duty_offloading":on_duty_offloading
                })
            
        
            else:
                on_duty_driving=off_duty_mandatory+timedelta(hours=8)#19 ghante and 25 ghanta raasta means 3 logs
                trip_time_elapsed=trip_time_elapsed+8
                break_after_driving=on_duty_driving+timedelta(minutes=30)
                driving_after_break=break_after_driving+timedelta(hours=3) #22 ghante
                trip_time_elapsed=trip_time_elapsed+3
                off_duty_mandatory=driving_after_break+timedelta(hours=10)
                log_objects.append({
                    "on_duty_driving":on_duty_driving,
                    "break_after_driving":break_after_driving,
                    "driving_after_break":driving_after_break,
                    "off_duty_mandatory":off_duty_mandatory
                })
        
        return {
            "leaflet_map_data":{
                "leaflet_lat_lng": leaflet_lat_lng,
                "fuel_cordinates": fuel_cordinates,
                "break_cordinates": break_cordinates,
                "day_off_cordinates": day_off_cordinates,
                "total_distance_miles": total_distance_miles,
                "total_duration_hours": total_duration_hours
            },
            "eld_log_data":log_objects
            
        }        
