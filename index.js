const fs = require('fs');
const path = require('path');
const http = require('http');
const multer = require('multer');

const dataDir = path.join(__dirname, 'data');
const shoppingListFile = path.join(dataDir, 'shopping-list.json');
const uploadDir = path.join(__dirname, 'uploads');

// Create directories if they don't exist
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

// Serve static files from the uploadDir
const serveImage = (req, res) => {
    const filePath = path.join(uploadDir, req.url.split('/uploads/')[1]);
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Image not found' }));
            return;
        }
        const ext = path.extname(filePath).slice(1);
        res.writeHead(200, { 'Content-Type': `image/${ext}` });
        res.end(data);
    });
};

// Create HTTP server
const server = http.createServer((req, res) => {
    if (req.url === '/shopping-list' && req.method === 'GET') {
        getShoppingList(req, res);
    } else if (req.url === '/shopping-list' && req.method === 'POST') {
        addItem(req, res);
    } else if (req.url.match(/\/shopping-list\/\w+/) && req.method === 'PUT') {
        updateItem(req, res);
    } else if (req.url.match(/^\/shopping-list\/\w+$/) && req.method === 'PATCH') {
        patchItem(req, res);
    } else if (req.url.match(/\/shopping-list\/\w+/) && req.method === 'DELETE') {
        deleteItem(req, res);
    } else if (req.url.startsWith('/uploads/')) {
        serveImage(req, res); // Serve uploaded images
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

// Add item with image upload
const addItem = (req, res) => {
    upload.single('image')(req, res, (err) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Failed to upload file' }));
            return;
        }

        const newItem = {
            id: req.body.id,
            name: req.body.name,
            quantity: Number(req.body.quantity),
            description: req.body.description,
            price: parseFloat(req.body.price),
            imagePath: req.file ? `/uploads/${req.file.filename}` : null // Use image URL
        };

        fs.readFile(shoppingListFile, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Failed to read shopping list' }));
                return;
            }

            const shoppingList = JSON.parse(data);
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
    });
};

const updateItem = (req, res) => {
    const id = req.url.split('/')[2];

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
                const updatedItem = JSON.parse(body);
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

                    // Delete old image if a new one is uploaded
                    const oldImagePath = shoppingList[index].imagePath;
                    if (req.file) {
                        if (oldImagePath) {
                            const oldImageFullPath = path.join(__dirname, oldImagePath);
                            fs.unlink(oldImageFullPath, (err) => {
                                if (err) {
                                    console.error('Failed to delete old image:', err);
                                }
                            });
                        }
                        updatedItem.imagePath = `/uploads/${req.file.filename}`; // Update image path with new one
                    }

                    shoppingList[index] = { ...shoppingList[index], ...updatedItem };

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
const deleteItem = (req, res) => {
    const id = req.url.split('/')[2];

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

        const itemToDelete = shoppingList[index];
        if (itemToDelete.imagePath) {
            const imagePath = path.join(__dirname, itemToDelete.imagePath);
            fs.unlink(imagePath, (err) => {
                if (err) {
                    console.error('Failed to delete image:', err);
                }
            });
        }

        shoppingList = shoppingList.filter(item => String(item.id) !== String(id));

        fs.writeFile(shoppingListFile, JSON.stringify(shoppingList, null, 2), (err) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Failed to update shopping list' }));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: `Item with ID ${id} deleted` }));
        });
    });
};