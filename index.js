const fs = require('fs');
const path = require('path');
const http = require('http');
const multer = require('multer');

const dataDir = path.join(__dirname, 'data');
const shoppingListFile = path.join(dataDir, 'shopping-list.json');
const uploadDir = path.join(__dirname, 'uploads');


if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

if (!fs.existsSync(shoppingListFile)) {
    fs.writeFileSync(shoppingListFile, JSON.stringify([]));
}

// Configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); // Save to uploads directory
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Initialize multer
const upload = multer({ storage });

const server = http.createServer((req, res) => {
    console.log(`Request URL: ${req.url}, Method: ${req.method}`);
    if (req.url === '/shopping-list' && req.method === 'GET') {
        getShoppingList(req, res);
    } else if (req.url === '/shopping-list' && req.method === 'POST') {
        console.log('Posted.');
        addItem(req, res);
    } else if (req.url.match(/\/shopping-list\/\w+/) && req.method === 'PUT') {
        updateItem(req, res);
    } else if (req.url.match(/^\/shopping-list\/\w+$/) && req.method === 'PATCH') {
        patchItem(req, res);
    } else if (req.url.match(/\/shopping-list\/\w+/) && req.method === 'DELETE') {
        deleteItem(req, res);
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Route not found' }));
    }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const getShoppingList = (req, res) => {
    fs.readFile(shoppingListFile, 'utf8', (err, data) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Failed to read shopping list' }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
    });
};
const addItem = (req, res) => {
    upload.single('image')(req, res, (err) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Failed to upload file' }));
            return;
        }

        try {
            // `req.body` will contain form data (excluding the file)
            const newItem = {
                id: req.body.id,
                name: req.body.name,
                quantity: Number(req.body.quantity), 
                description: req.body.description,
                price: parseFloat(req.body.price),
                imagePath: req.file ? req.file.path : null 
            };

            // Read the shopping list file
            fs.readFile(shoppingListFile, 'utf8', (err, data) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Failed to read shopping list' }));
                    return;
                }

                const shoppingList = JSON.parse(data);

                // Check for duplicate ID
                const duplicateItem = shoppingList.find(item => String(item.id) === String(newItem.id));
                if (duplicateItem) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: `Item with ID ${newItem.id} already exists` }));
                    return;
                }

                shoppingList.push(newItem);

                fs.writeFile(shoppingListFile, JSON.stringify(shoppingList, null, 2), (err) => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Failed to update shopping list' }));
                        return;
                    }
                    res.writeHead(201, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(newItem));
                });
            });
        } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Invalid data format' }));
        }
    });
};


const patchItem = (req, res) => {
    const id = req.url.split('/')[2]; // Extract the ID from the URL

    upload.single('image')(req, res, (err) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Failed to upload file' }));
            return;
        }

        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const patchData = JSON.parse(body);


                // Read the shopping list file
                fs.readFile(shoppingListFile, 'utf8', (err, data) => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Failed to read shopping list' }));
                        return;
                    }

                    let shoppingList = JSON.parse(data);
                    const index = shoppingList.findIndex(item => String(item.id) === String(id));

                    if (index === -1) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Item not found' }));
                        return;
                    }

                    // Update the item with new data and image if uploaded
                    shoppingList[index] = {
                        ...shoppingList[index],
                        ...patchData,
                        imagePath: req.file ? req.file.path : shoppingList[index].imagePath
                    };

                    // Write the updated shopping list
                    fs.writeFile(shoppingListFile, JSON.stringify(shoppingList, null, 2), err => {
                        if (err) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Failed to update shopping list' }));
                            return;
                        }

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(shoppingList[index]));
                    });
                });
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Invalid JSON input' }));
            }
        });
    });
};


const updateItem = (req, res) => {
    const id = req.url.split('/')[2]; // Extract the ID from the URL

    upload.single('image')(req, res, (err) => {
        if (err) {
            console.error('File upload error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Failed to upload file' }));
            return;
        }

        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            console.log('Request body received:', body);
            try {
                const updatedItem = JSON.parse(body);
                
                // Convert quantity and price to numbers
                if (updatedItem.quantity) {
                    updatedItem.quantity = Number(updatedItem.quantity);
                }
                if (updatedItem.price) {
                    updatedItem.price = parseFloat(updatedItem.price);
                }

                // Read the shopping list file
                fs.readFile(shoppingListFile, 'utf8', (err, data) => {
                    if (err) {
                        console.error('Failed to read shopping list:', err);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Failed to read shopping list' }));
                        return;
                    }

                    let shoppingList = JSON.parse(data);
                    const index = shoppingList.findIndex(item => String(item.id) === String(id));

                    if (index === -1) {
                        console.log('Item not found:', id);
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Item not found' }));
                        return;
                    }

                    // Update the item with new data and image if uploaded
                    shoppingList[index] = {
                        ...shoppingList[index],
                        ...updatedItem,
                        imagePath: req.file ? req.file.path : shoppingList[index].imagePath // Only update if a new image is provided
                    };

                    fs.writeFile(shoppingListFile, JSON.stringify(shoppingList, null, 2), err => {
                        if (err) {
                            console.error('Failed to update shopping list:', err);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Failed to update shopping list' }));
                            return;
                        }

                        console.log('Shopping list updated successfully:', shoppingList[index]);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(shoppingList[index]));
                    });
                });
            } catch (e) {
                console.error('Invalid JSON input:', e);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Invalid JSON input' }));
            }
        });
    });
};


const deleteItem = (req, res) => {
    const id = req.url.split('/')[2];

    fs.readFile(shoppingListFile, 'utf8', (err, data) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Failed to read shopping list' }));
            return;
        }

        let shoppingList = JSON.parse(data);
        const index = shoppingList.findIndex(item => item.id === id);

        if (index === -1) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Item not found' }));
            return;
        }

        shoppingList.splice(index, 1);

        fs.writeFile(shoppingListFile, JSON.stringify(shoppingList), err => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Failed to update shopping list' }));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Item deleted' }));
        });
    });
};
