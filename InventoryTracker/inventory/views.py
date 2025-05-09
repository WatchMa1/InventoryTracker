from django.shortcuts import render
from rest_framework import generics, status, filters
from rest_framework.response import Response
from .models import Product, StockMovement
from .serializers import ProductSerializer, StockMovementSerializer
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.pagination import PageNumberPagination

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100

class StockLevelListView(generics.ListAPIView):
    """
    API endpoint that returns current stock for all products
    """
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

class StockMovementListCreateView(generics.ListCreateAPIView):
    """
    API endpoint that allows:
    - Stock movements to be listed with filtering by date and product
    - Stock movements to be created with validation
    """
    queryset = StockMovement.objects.all().order_by('-movement_date', '-time', '-id')
    serializer_class = StockMovementSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['product', 'movement_type']
    ordering_fields = ['movement_date', 'time', 'product', 'quantity']
    
    def get_queryset(self):
        """
        Optionally restricts the returned movements by filtering against
        query parameters in the URL:
        - product: filter by product ID
        - start_date: filter by movements on or after this date
        - end_date: filter by movements on or before this date
        """
        queryset = super().get_queryset()
        
        # Filter by product ID if provided
        product_id = self.request.query_params.get('product', None)
        if product_id:
            queryset = queryset.filter(product__id=product_id)
        
        # Filter by date range if provided
        start_date = self.request.query_params.get('start_date', None)
        if start_date:
            queryset = queryset.filter(movement_date__gte=start_date)
        
        end_date = self.request.query_params.get('end_date', None)
        if end_date:
            queryset = queryset.filter(movement_date__lte=end_date)
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        # Set default date and time if not provided
        if 'movement_date' not in request.data:
            request.data['movement_date'] = timezone.now().date().isoformat()
        if 'time' not in request.data:
            request.data['time'] = timezone.now().time().isoformat()
            
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data, 
            status=status.HTTP_201_CREATED, 
            headers=headers
        )
