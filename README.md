# Node.js File Manager & Shopping List API

## Overview
This project is a Node.js application that serves as both a basic file manager and a REST API for managing a shopping list. It uses Node.js' built-in `fs` module to store shopping list data in JSON format and implements CRUD operations (Create, Read, Update, Delete) via HTTP endpoints.

Additionally, the app allows file uploads (images) for shopping list items using the `multer` middleware. The uploaded files are stored in an `uploads` directory and can be accessed through API requests.

## Features

### File Manager
- Creates directories (`data`, `uploads`) if they don't already exist.
- Creates a `shopping-list.json` file to store shopping list data in the `data` directory.
- Reads and writes to the `shopping-list.json` file.
- Manages image uploads for shopping list items.

### Shopping List API
- **GET** `/shopping-list`: Retrieves the current shopping list.
- **POST** `/shopping-list`: Adds a new item to the shopping list, with optional image upload.
- **PUT** `/shopping-list/:id`: Updates an existing shopping list item, including replacing an uploaded image.
- **PATCH** `/shopping-list/:id`: Partially updates a shopping list item.
- **DELETE** `/shopping-list/:id`: Deletes an item from the shopping list and removes its associated image (if present).
- **GET** `/uploads/:filename`: Serves uploaded images.

## Setup and Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
