from django.urls import path
from .views import StockLevelListView, StockMovementListCreateView

urlpatterns = [
    path('api/stock-levels/', StockLevelListView.as_view(), name='stock-levels'),
    path('api/stock-movement/', StockMovementListCreateView.as_view(), name='stock-movement'),
]