# RestaurantAI Development Workflow

This document defines the standard workflow for every module in the project.

## Module Implementation Sequence

1. Design the database table
   - Define the columns, relationships, constraints, and indexes.
   - Add the schema in the database SQL files.

2. Create backend APIs
   - Implement GET, POST, PUT, and DELETE endpoints.
   - Follow the existing response structure:
     - success: true/false
     - message
     - data

3. Test the APIs in Postman
   - Verify success and error responses.
   - Confirm authentication and validation behavior.

4. Build the React page
   - Create or update the page under the relevant module folder.
   - Use the existing admin layout and UI patterns.

5. Connect the frontend to the backend
   - Add or update service methods in the frontend services layer.
   - Call the backend endpoints from the page component.

6. Add validation and error handling
   - Validate required fields.
   - Handle loading, success, and failure states clearly.

7. Improve the UI
   - Refine spacing, icons, forms, tables, and feedback states.
   - Keep the interface clean and consistent.

## Recommended Folder Structure

- src
  - components
  - layout
  - cards
  - charts
  - tables
  - forms
  - pages
  - services
  - hooks
  - context
  - utils

## Module Checklist

For every new module, confirm the following:

- Database schema exists
- Backend routes are implemented
- Frontend page exists
- Services connect to the backend
- Validation and error handling are included
- UI is polished and consistent

## Example Module Flow

For a module such as Orders or Customers:

- Add or update the database table definition
- Create backend controller and route handlers
- Test endpoints with sample payloads
- Build the page UI
- Connect the page to the service layer
- Handle empty, loading, and error states
- Improve table and form styling
