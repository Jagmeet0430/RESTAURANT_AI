class CartManager:

    def __init__(self):
        self.cart = []

    def add_item(self, item):
        self.cart.append(item)

    def remove_item(self, item):
        if item in self.cart:
            self.cart.remove(item)

    def get_cart(self):
        return self.cart

    def clear_cart(self):
        self.cart.clear()