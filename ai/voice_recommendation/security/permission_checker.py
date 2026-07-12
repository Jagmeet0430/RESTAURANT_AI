class PermissionChecker:

    def can_access(self, role):

        if role == "customer":
            return True

        return False