document.addEventListener('DOMContentLoaded', () => {
    // Backend API URLs
    const STOCK_LEVELS_API = 'http://localhost:8000/api/stock-levels/';
    const STOCK_MOVEMENTS_API = 'http://localhost:8000/api/stock-movement/';

    // DOM elements
    const stockTable = document.getElementById('stockTable');
    const movementsTable = document.getElementById('movementsTable');
    const refreshBtn = document.getElementById('refreshBtn');
    const errorAlert = document.getElementById('errorAlert');
    const errorMessage = document.getElementById('errorMessage');

    // Filter elements
    const productFilter = document.getElementById('productFilter');
    const startDateFilter = document.getElementById('startDate');
    const endDateFilter = document.getElementById('endDate');
    const applyFiltersBtn = document.getElementById('applyFilters');
    const resetFiltersBtn = document.getElementById('resetFilters');

    // Pagination elements
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');

    // Form elements
    const stockMovementForm = document.getElementById('stockMovementForm');
    const movementProduct = document.getElementById('movementProduct');
    const movementType = document.getElementById('movementType');
    const movementQuantity = document.getElementById('movementQuantity');
    const movementDate = document.getElementById('movementDate');
    const movementTime = document.getElementById('movementTime');
    const formSuccess = document.getElementById('formSuccess');
    const formError = document.getElementById('formError');
    const formErrorMessage = document.getElementById('formErrorMessage');

    // Pagination state
    let currentPage = 1;
    let totalPages = 1;
    let pageSize = 10;
    let totalItems = 0;

    // Filter state
    let filters = {
        product_id: '',
        start_date: '',
        end_date: ''
    };

    // Products data cache
    let productsCache = [];

    // Fetch stock levels from API
    const fetchStockLevels = async () => {
        try {
            showLoading(stockTable);
            hideError();

            console.log("Fetching stock levels from:", STOCK_LEVELS_API);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            const response = await fetch(STOCK_LEVELS_API, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                console.error("API did not return JSON. Content-Type:", contentType);
                throw new Error("API did not return JSON data");
            }

            const data = await response.json();
            console.log("API Response:", data);

            // Verify data structure
            if (!data) {
                console.error("API returned null or undefined data");
                throw new Error("API returned empty data");
            }

            // Store products in cache first - handle both array and object with results
            if (Array.isArray(data)) {
                console.log("API returned an array of", data.length, "products");
                productsCache = data;
            } else if (data.results && Array.isArray(data.results)) {
                console.log("API returned an object with results array of", data.results.length, "products");
                productsCache = data.results;
            } else {
                console.error("API returned unexpected data format:", data);
                productsCache = [];
            }

            // Display stock data after caching
            displayStockData(productsCache);

            // Debug what's in the product cache
            console.log("Products in cache:", productsCache);
            if (productsCache.length > 0) {
                console.log("Sample product:", productsCache[0]);
            }

            // Populate dropdowns only if we have products
            if (productsCache.length > 0) {
                console.log("Populating product dropdowns with products");
                populateProductDropdowns(productsCache);
            } else {
                console.warn("No products available to populate dropdowns");
                showError("No products found in database. Please add products first.");
            }

            return data;
        } catch (error) {
            console.error('Error fetching stock data:', error);
            let errorMsg = error.name === 'AbortError'
                ? 'Request timed out. The server might be unavailable.'
                : `Error loading stock data: ${error.message}`;
            showError(errorMsg);
            displayEmptyTable(stockTable, 6);
            return [];
        }
    };

    // Fetch stock movements with filters
    const fetchStockMovements = async () => {
        try {
            showLoading(movementsTable);
            hideError();

            // Create a complete URL to ensure proper URL construction
            let url = new URL(STOCK_MOVEMENTS_API);

            // Add filters as query parameters
            if (filters.product_id) {
                url.searchParams.append('product', filters.product_id);
            }
            if (filters.start_date) {
                url.searchParams.append('start_date', filters.start_date);
            }
            if (filters.end_date) {
                url.searchParams.append('end_date', filters.end_date);
            }

            // Add pagination
            url.searchParams.append('page', currentPage);
            url.searchParams.append('page_size', pageSize);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            const response = await fetch(url, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            displayMovementsData(data.results || data);

            // Update pagination info if available
            if (data.count !== undefined) {
                totalItems = data.count;
                totalPages = Math.ceil(totalItems / pageSize);
                updatePaginationControls();
            } else {
                // Handle case where pagination is not provided by API
                const dataArray = Array.isArray(data) ? data : (data.results || []);
                totalItems = dataArray.length;
                totalPages = 1;
                updatePaginationControls();
            }

            return data;
        } catch (error) {
            console.error('Error fetching movement data:', error);
            let errorMsg = error.name === 'AbortError'
                ? 'Request timed out. The server might be unavailable.'
                : `Error loading movement data: ${error.message}`;
            showError(errorMsg);
            displayEmptyTable(movementsTable, 6);

            // Reset pagination info on error
            totalItems = 0;
            totalPages = 0;
            updatePaginationControls();

            return { results: [] };
        }
    };

    // Display stock data in table
    const displayStockData = (data) => {
        if (!data || data.length === 0) {
            displayEmptyTable(stockTable, 6, 'No inventory items found');
            return;
        }

        stockTable.innerHTML = data.map(product => `
            <tr>
                <td>${product.id}</td>
                <td>${escapeHtml(product.name)}</td>
                <td>${escapeHtml(product.description)}</td>
                <td>${escapeHtml(product.product_type)}</td>
                <td>${product.current_stock}</td>
                <td>${getStockStatusBadge(product.current_stock)}</td>
            </tr>
        `).join('');
    };

    // Display stock movements data in table
    const displayMovementsData = (data) => {
        if (!data || data.length === 0) {
            displayEmptyTable(movementsTable, 6, 'No movements found for the selected filters');
            updatePaginationInfo(0);
            return;
        }

        movementsTable.innerHTML = data.map(movement => {
            // Find product name by id from cache
            const product = productsCache.find(p => p.id === movement.product) || {};
            const productName = product.name || "Unknown Product"; // Changed to "Unknown Product" instead of showing product number

            return `
                <tr>
                    <td>${movement.id}</td>
                    <td>${escapeHtml(productName)}</td>
                    <td>${getMovementTypeBadge(movement.movement_type)}</td>
                    <td>${movement.quantity}</td>
                    <td>${formatDate(movement.movement_date)}</td>
                    <td>${movement.time || 'N/A'}</td>
                </tr>
            `;
        }).join('');

        updatePaginationInfo(data.length);
    };

    // Populate product filter dropdown
    const populateProductFilter = (products) => {
        // Clear existing options except the first one
        while (productFilter.options.length > 1) {
            productFilter.remove(1);
        }

        // Add products to filter dropdown
        if (products && products.length > 0) {
            products.forEach(product => {
                const option = document.createElement('option');
                option.value = product.id;
                option.textContent = product.name;
                productFilter.appendChild(option);
            });
        }
    };

    // Populate product dropdown for form
    const populateProductDropdowns = (products) => {
        try {
            console.log("Starting to populate dropdowns with", products.length, "products");

            // Re-fetch elements to ensure we have them
            const productFilterElem = document.getElementById('productFilter');
            const movementProductElem = document.getElementById('movementProduct');

            if (!productFilterElem) {
                console.error("productFilter element not found in DOM!");
            }

            if (!movementProductElem) {
                console.error("movementProduct element not found in DOM!");
            }

            if (!productFilterElem || !movementProductElem) {
                console.error("Critical dropdown elements missing from DOM");
                return;
            }

            // Clear existing options except the first one from filter dropdown
            while (productFilterElem.options.length > 1) {
                productFilterElem.remove(1);
            }

            // Clear existing options except the first one from form dropdown
            while (movementProductElem.options.length > 1) {
                movementProductElem.remove(1);
            }

            // Add products to both dropdowns
            let filterAdded = 0;
            let formAdded = 0;

            if (products && products.length > 0) {
                products.forEach(product => {
                    // More detailed validation
                    if (product.id === undefined || product.id === null) {
                        console.warn("Product missing ID:", product);
                        return; // Skip this product
                    }

                    if (!product.name) {
                        console.warn("Product missing name:", product);
                        return; // Skip this product
                    }

                    // For filter dropdown
                    try {
                        const filterOption = document.createElement('option');
                        filterOption.value = product.id;
                        filterOption.textContent = product.name;
                        productFilterElem.appendChild(filterOption);
                        filterAdded++;
                    } catch (err) {
                        console.error("Error adding to filter dropdown:", err);
                    }

                    // For form dropdown
                    try {
                        const formOption = document.createElement('option');
                        formOption.value = product.id;
                        formOption.textContent = product.name;
                        movementProductElem.appendChild(formOption);
                        formAdded++;
                    } catch (err) {
                        console.error("Error adding to movement dropdown:", err);
                    }
                });

                console.log(`Added ${filterAdded} products to filter dropdown and ${formAdded} to movement dropdown`);

                // Verify options were added
                console.log(`Filter dropdown now has ${productFilterElem.options.length} options`);
                console.log(`Movement dropdown now has ${movementProductElem.options.length} options`);
            } else {
                console.warn("No products to populate dropdowns with");
            }
        } catch (error) {
            console.error("Error populating product dropdowns:", error);
        }
    };

    // Get stock status badge based on stock level
    const getStockStatusBadge = (stock) => {
        if (stock <= 0) {
            return '<span class="stock-status out-of-stock">Out of stock</span>';
        } else if (stock < 10) {
            return '<span class="stock-status low-stock">Low stock</span>';
        } else {
            return '<span class="stock-status in-stock">In stock</span>';
        }
    };

    // Get movement type badge
    const getMovementTypeBadge = (type) => {
        switch (type) {
            case 'Inbound':
                return '<span class="movement-inbound">Inbound</span>';
            case 'Outbound':
                return '<span class="movement-outbound">Outbound</span>';
            default:
                return escapeHtml(type);
        }
    };

    // Format date for display
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';

        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        try {
            return new Date(dateString).toLocaleDateString(undefined, options);
        } catch (e) {
            return dateString;
        }
    };

    // Update pagination controls
    const updatePaginationControls = () => {
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages || totalPages === 0;

        updatePaginationInfo();
    };

    // Update pagination info text
    const updatePaginationInfo = (currentCount = 0) => {
        if (totalItems > 0 && currentCount > 0) {
            const start = (currentPage - 1) * pageSize + 1;
            const end = Math.min(start + currentCount - 1, totalItems);
            pageInfo.textContent = `Showing ${start}-${end} of ${totalItems} records`;
        } else {
            pageInfo.textContent = `No records found`;
            // Make sure pagination buttons are disabled when no results
            prevPageBtn.disabled = true;
            nextPageBtn.disabled = true;
        }
    };

    // Display empty table with message
    const displayEmptyTable = (tableElement, colSpan, message = 'No data available') => {
        tableElement.innerHTML = `
            <tr>
                <td colspan="${colSpan}" class="text-center">${message}</td>
            </tr>
        `;
    };

    // Show loading indicator
    const showLoading = (tableElement) => {
        const colSpan = tableElement === stockTable ? 6 : 6; // Both tables have 6 columns
        tableElement.innerHTML = `
            <tr>
                <td colspan="${colSpan}" class="text-center">
                    <div class="d-flex justify-content-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </div>
                    <div class="mt-2">Loading data...</div>
                </td>
            </tr>
        `;
    };

    // Show error message
    const showError = (message) => {
        errorMessage.textContent = message;
        errorAlert.classList.remove('d-none');
    };

    // Hide error message
    const hideError = () => {
        errorAlert.classList.add('d-none');
    };

    // Show form success message
    const showFormSuccess = () => {
        formSuccess.classList.remove('d-none');
        // Hide after 3 seconds
        setTimeout(() => {
            formSuccess.classList.add('d-none');
        }, 3000);
    };

    // Show form error message
    const showFormError = (message) => {
        formErrorMessage.textContent = message || 'Error submitting stock movement';
        formError.classList.remove('d-none');
    };

    // Hide form alerts
    const hideFormAlerts = () => {
        formSuccess.classList.add('d-none');
        formError.classList.add('d-none');
    };

    // Apply filters and fetch data
    const applyFilters = () => {
        filters.product_id = productFilter.value;
        filters.start_date = startDateFilter.value;
        filters.end_date = endDateFilter.value;

        // Reset to first page when applying filters
        currentPage = 1;

        fetchStockMovements();
    };

    // Reset filters
    const resetFilters = () => {
        productFilter.value = '';
        startDateFilter.value = '';
        endDateFilter.value = '';

        filters = {
            product_id: '',
            start_date: '',
            end_date: ''
        };

        currentPage = 1;

        fetchStockMovements();
    };

    // Previous page handler
    const goToPrevPage = () => {
        if (currentPage > 1) {
            currentPage--;
            fetchStockMovements();
        }
    };

    // Next page handler
    const goToNextPage = () => {
        if (currentPage < totalPages) {
            currentPage++;
            fetchStockMovements();
        }
    };

    // Escape HTML to prevent XSS
    const escapeHtml = (unsafe) => {
        if (typeof unsafe !== 'string') return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    // Set default dates if empty
    const setDefaultDates = () => {
        const today = new Date();

        // Default end date to today if not set
        if (!endDateFilter.value) {
            const formattedToday = today.toISOString().split('T')[0];
            endDateFilter.value = formattedToday;
        }

        // Default start date to 30 days ago if not set
        if (!startDateFilter.value) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(today.getDate() - 30);
            const formattedStart = thirtyDaysAgo.toISOString().split('T')[0];
            startDateFilter.value = formattedStart;
        }
    };

    // Get current date in YYYY-MM-DD format
    const getCurrentDate = () => {
        return new Date().toISOString().split('T')[0];
    };

    // Get current time in HH:MM format
    const getCurrentTime = () => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    };

    // Handle form submission
    const handleFormSubmit = async (event) => {
        event.preventDefault();

        // Clear previous alerts
        hideFormAlerts();

        // Validate the form using Bootstrap's validation
        if (!stockMovementForm.checkValidity()) {
            event.stopPropagation();
            stockMovementForm.classList.add('was-validated');
            return;
        }

        // Get form values
        const formData = {
            product: movementProduct.value,
            movement_type: movementType.value,
            quantity: parseInt(movementQuantity.value, 10),
            movement_date: movementDate.value || getCurrentDate(),
            time: movementTime.value || getCurrentTime()
        };

        try {
            // Send data to API
            const response = await fetch(STOCK_MOVEMENTS_API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.detail || 'Error submitting stock movement');
            }

            // Show success message
            showFormSuccess();

            // Reset form
            stockMovementForm.reset();
            stockMovementForm.classList.remove('was-validated');

            // Update data
            fetchStockLevels();
            fetchStockMovements();

        } catch (error) {
            console.error('Error submitting stock movement:', error);
            showFormError(error.message);
        }
    };

    // Set default form date/time
    const setDefaultFormValues = () => {
        movementDate.value = getCurrentDate();
        movementTime.value = getCurrentTime();
    };

    // Event listeners
    refreshBtn.addEventListener('click', () => {
        fetchStockLevels();
        fetchStockMovements();
    });

    applyFiltersBtn.addEventListener('click', applyFilters);
    resetFiltersBtn.addEventListener('click', resetFilters);

    // Add validation for date ranges
    startDateFilter.addEventListener('change', () => {
        // Ensure end date is not before start date
        if (endDateFilter.value && startDateFilter.value > endDateFilter.value) {
            endDateFilter.value = startDateFilter.value;
        }
    });

    endDateFilter.addEventListener('change', () => {
        // Ensure start date is not after end date
        if (startDateFilter.value && endDateFilter.value < startDateFilter.value) {
            startDateFilter.value = endDateFilter.value;
        }
    });

    prevPageBtn.addEventListener('click', goToPrevPage);
    nextPageBtn.addEventListener('click', goToNextPage);

    // Add form submit event listener
    stockMovementForm.addEventListener('submit', handleFormSubmit);

    // Initial data load
    const initialize = async () => {
        await fetchStockLevels();
        setDefaultDates(); // Set default dates before fetching movements
        setDefaultFormValues(); // Set default form date/time
        await fetchStockMovements();
    };

    initialize();
});