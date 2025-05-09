from rest_framework import serializers
from .models import Product, StockMovement
from django.db.models import Sum

class ProductSerializer(serializers.ModelSerializer):
    current_stock = serializers.SerializerMethodField()
    
    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'product_type', 'current_stock']
    
    def get_current_stock(self, obj):
        # Calculate current stock by subtracting outbound from inbound movements
        inbound = StockMovement.objects.filter(
            product=obj, 
            movement_type=StockMovement.INBOUND
        ).aggregate(total=Sum('quantity'))['total'] or 0
        
        outbound = StockMovement.objects.filter(
            product=obj, 
            movement_type=StockMovement.OUTBOUND
        ).aggregate(total=Sum('quantity'))['total'] or 0
        
        return inbound - outbound

class StockMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockMovement
        fields = ['id', 'product', 'quantity', 'movement_type', 'movement_date', 'time']

    def validate(self, data):
        """
        Validate that there is enough stock for outbound movements
        """
        if data['movement_type'] == StockMovement.OUTBOUND:
            # Get the product's current stock
            product = data['product']
            inbound = StockMovement.objects.filter(
                product=product, 
                movement_type=StockMovement.INBOUND
            ).aggregate(total=Sum('quantity'))['total'] or 0
            
            outbound = StockMovement.objects.filter(
                product=product, 
                movement_type=StockMovement.OUTBOUND
            ).aggregate(total=Sum('quantity'))['total'] or 0
            
            current_stock = inbound - outbound
            
            # Check if there's enough stock for the outbound movement
            if data['quantity'] > current_stock:
                raise serializers.ValidationError(
                    f"Not enough stock. Current stock: {current_stock}, Requested: {data['quantity']}"
                )
        
        return data