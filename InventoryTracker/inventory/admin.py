from django.contrib import admin
from .models import Product, StockMovement
from django.db.models import Sum
from django.utils.html import format_html

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'description', 'product_type', 'current_stock', 'stock_status')
    list_filter = ('product_type',)
    search_fields = ('name', 'description', 'product_type')
    
    def current_stock(self, obj):
        inbound = StockMovement.objects.filter(
            product=obj, 
            movement_type=StockMovement.INBOUND
        ).aggregate(total=Sum('quantity'))['total'] or 0
        
        outbound = StockMovement.objects.filter(
            product=obj, 
            movement_type=StockMovement.OUTBOUND
        ).aggregate(total=Sum('quantity'))['total'] or 0
        
        return inbound - outbound
    
    current_stock.short_description = 'Current Stock'
    
    def stock_status(self, obj):
        stock = self.current_stock(obj)
        if stock <= 0:
            return format_html('<span style="color: red; font-weight: bold;">Out of stock</span>')
        elif stock < 10:
            return format_html('<span style="color: orange; font-weight: bold;">Low stock</span>')
        else:
            return format_html('<span style="color: green; font-weight: bold;">In stock</span>')
    
    stock_status.short_description = 'Status'

@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ('product', 'quantity', 'movement_type', 'movement_date', 'time')
    list_filter = ('movement_type', 'movement_date', 'product')
    date_hierarchy = 'movement_date'
    search_fields = ('product__name',)
    list_select_related = ('product',)
    
    def has_delete_permission(self, request, obj=None):
        # Prevent deletion of stock movements to maintain inventory integrity
        return False