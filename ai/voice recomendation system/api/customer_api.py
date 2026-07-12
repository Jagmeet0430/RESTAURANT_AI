class CustomerAPI:

    def __init__(self):
        self.customers = []

    def add_customer(self, name, phone):
        customer = {
            "name": name,
            "phone": phone
        }
        self.customers.append(customer)
        return customer

    def get_customers(self):
        return self.customers