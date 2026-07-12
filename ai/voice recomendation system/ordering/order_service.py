class OrderService:

    def place_order(self, customer, cart):

        return {
            "customer": customer,
            "items": cart,
            "status": "Order Placed"
        }