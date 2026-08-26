import this
from django.shortcuts import render
from django.views import View
from django.http import JsonResponse
import json

from eld.schema import CalculateTripRequestDto
from pydantic import ValidationError
from .services import EldService
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt


# Create your views here.
@method_decorator(csrf_exempt, name='dispatch')
class EldController(View):
    def post(self,request): 

        try:
        
            body=json.loads(request.body)
            
            #performing validation
            dto= CalculateTripRequestDto(**body)

            response = EldService.calculate_trip(dto)
            return JsonResponse({"status":"success","data":response}) 
        
        except json.JSONDecodeError:

            return JsonResponse({"status": "error", "message": "Invalid JSON body"}, status=400)
        
        except ValidationError as e:
            # Return detailed Pydantic validation error messages
            return JsonResponse({"status": "error", "errors": e.errors()}, status=422)