from django.db import models


class Product(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()
    product_type = models.TextField()

    def __str__(self):
        return self.name

class StockMovement(models.Model):
    INBOUND = 'Inbound'
    OUTBOUND = 'Outbound'
    MOVEMENT_CHOICES = [
        (INBOUND, 'Inbound'),
        (OUTBOUND, 'Outbound'),
    ]

    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField()
    movement_type = models.CharField(max_length=10, choices=MOVEMENT_CHOICES)
    movement_date = models.DateField()
    time = models.TimeField()

    def __str__(self):
        return f"{self.movement_type} - {self.product.name} ({self.quantity})"
