class Auth:

    def __init__(self):
        self.allowed_users = {
            "customer": "1234"
        }

    def login(self, username, password):
        return self.allowed_users.get(username) == password

    def logout(self):
        return True