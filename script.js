document.addEventListener("DOMContentLoaded", () => {
    const registerForm = document.getElementById("registerForm");
    const loginForm = document.getElementById("loginForm");
    const addExpenseForm = document.getElementById("addExpenseForm");
    const addBudgetForm = document.getElementById("addBudgetForm");
    const editExpenseForm = document.getElementById("editExpenseForm");
    const deleteExpenseForm = document.getElementById("deleteExpenseForm");
    const deleteMessage = document.getElementById("deleteMessage");
    const viewExpenseForm = document.getElementById("viewExpenseForm");
    const expensesList = document.getElementById("expensesList");
    const expensesTable = document.getElementById("expensesTable");

    function setTodayDate() {
        const today = new Date().toISOString().split('T')[0];
        console.log('Today\'s date:', today); // Debugging line
        const dateInputs = document.querySelectorAll('input[type="date"]');
        dateInputs.forEach(input => {
            console.log('Setting date for:', input); // Debugging line
            input.value = today;
        });
    }

    // Handle Registration
    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(registerForm);
            const email = formData.get("email");
            const username = formData.get("username");
            const password = formData.get("password");

            try {
                const response = await fetch("http://localhost:4000/register", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ email, username, password }),
                });

                if (response.ok) {
                    alert("Registration successful");
                    window.location.href = "login.html"; // Ensure this path is correct
                } else {
                    const errorText = await response.text();
                    alert(`Registration failed: ${errorText}`);
                }
            } catch (error) {
                console.error("Error:", error);
                alert("An error occurred. Please try again.");
            }
        });
    }

    // Handle Login
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(loginForm);
            const email= formData.get("email");
            const username= formData.get("username");
            const password = formData.get("password");

            try {
                const response = await fetch("http://localhost:4000/login", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ email, username, password }),
                });

                if (response.ok) {
                    const data=await response.json();

                    if (data.token){
                        localStorage.setItem("token", data.token);
                    alert("Login successful");
                    window.location.href = "dashboard.html"; // Adjust this path as needed
                    }else {
                        alert("no token recieved");
                    }
                } else {
                    const errorText = await response.text();
                    alert(`Login failed: ${errorText}`);
                }
            } catch (error) {
                console.error("Error:", error);
                alert("An error occurred. Please try again.");
            }
        });
    }

    // Handle adding an expense
    if (addExpenseForm) {
        addExpenseForm.addEventListener("submit", async (event) => {
            event.preventDefault(); // Prevent default form submission
            const formData = new FormData(addExpenseForm);
            const user_id = formData.get("user_id");
            const amount = formData.get("amount");
            const date = formData.get("date");
            const category = formData.get("category");

            try {
                const response = await fetch("http://localhost:4000/expenses", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ user_id, amount, date, category }),
                });

                if (response.ok) {
                    alert("Expense added successfully");
                    addExpenseForm.reset();
                    fetchAndDisplayExpenses(); // Update the list of expenses without reloading
                } else {
                    const result = await response.text();
                    alert(`Error adding expense: ${result}`);
                }
            } catch (err) {
                console.error("Error adding expense:", err);
                alert("An error occurred. Please try again.");
            }
        });
    }


    // Handle editing an expense
    if (editExpenseForm) {
        editExpenseForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const formData = new FormData(editExpenseForm);
            const expenseId = formData.get('expense_id');
            const user_id = formData.get("user_id");
            const amount = formData.get("amount");
            const date = formData.get("date");
            const category = formData.get("category");

            try {
                const response = await fetch(`http://localhost:4000/expenses/${expenseId}`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ user_id, amount, date, category }),
                });

                if (response.ok) {
                    alert("Expense edited successfully");
                    editExpenseForm.reset();
                    fetchAndDisplayExpenses(); // Update the list of expenses without reloading
                } else {
                    const result = await response.text();
                    alert(`Error editing expense: ${result}`);
                }
            } catch (err) {
                console.error("Error editing expense:", err);
                alert("An error occurred. Please try again.");
            }
        });
    }

    // Handle deleting an expense
    if (deleteExpenseForm) {
        deleteExpenseForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const formData = new FormData(deleteExpenseForm);
            const expenseId = formData.get("expense_id");

            try {
                const response = await fetch(`http://localhost:4000/expenses/${expenseId}`, {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                if (response.ok) {
                    if (deleteMessage) {
                        deleteMessage.textContent = 'Expense deleted successfully';
                        deleteMessage.style.color = 'green';
                    }
                    deleteExpenseForm.reset();
                    fetchAndDisplayExpenses(); // Update the list of expenses without reloading
                } else {
                    const errorText = await response.text();
                    if (deleteMessage) {
                        deleteMessage.textContent = `Error deleting expense: ${errorText}`;
                        deleteMessage.style.color = 'red';
                    }
                }
            } catch (err) {
                console.error("Error deleting expense:", err);
                if (deleteMessage) {
                    deleteMessage.textContent = "An error occurred. Please try again.";
                    deleteMessage.style.color = 'red';
                }
            }
        });
    }

    // View expenses handler
    if (viewExpenseForm) {
        viewExpenseForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const userId = localStorage.getItem("userId");

            if (!userId) {
                alert("User not logged in.");
                return;
            }

            try {
                const response = await fetch(`http://localhost:4000/expenses/${userId}`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${localStorage.getItem("token")}` // Include token if required
                    },
                });

                if (response.ok) {
                    const result = await response.json();
                    if (expensesList) {
                        expensesList.innerHTML = "";

                        if (Array.isArray(result) && result.length > 0) {
                            const table = document.createElement('table');
                            table.innerHTML = `
                                <thead>
                                    <tr>
                                        <th>Amount</th>
                                        <th>Date</th>
                                        <th>Category</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${result.map(expense => `
                                        <tr>
                                            <td>${expense.amount}</td>
                                            <td>${expense.date}</td>
                                            <td>${expense.category}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            `;
                            expensesList.appendChild(table);
                        } else {
                            expensesList.innerHTML = "<p>No expenses found.</p>";
                        }
                    }
                } else {
                    const errorText = await response.text();
                    alert(`Error fetching expenses: ${errorText}`);
                }
            } catch (err) {
                console.error("Error fetching expenses:", err);
                alert("An error occurred. Please try again.");
            }
        });
    }

    // Display all expenses
    function fetchAndDisplayExpenses() {
        const userId = localStorage.getItem("userId");
        if (!userId) return; // No user ID, exit early

        fetch(`http://localhost:4000/expenses?user_id=${userId}`)
            .then(response => response.json())
            .then(expenses => {
                if (expensesTable) {
                    expensesTable.innerHTML = ""; // Clear existing table rows
                    expenses.forEach(expense => {
                        const tr = document.createElement("tr");
                        tr.setAttribute("data-id", expense.id);
                        tr.innerHTML = `
                            <td>${expense.id}</td>
                            <td>${expense.category}</td>
                            <td>${expense.amount}</td>
                            <td>${new Date(expense.date).toLocaleString("en-US",
                                {
                                    weekday:"short", year: "numeric", "day": "numeric"
                                }
                            )}</td>
                                <button class="edit-btn">Edit</button>
                                <button class="delete-btn">Delete</button>
                            </td>
                        `;
                        expensesTable.appendChild(tr);
                    });
                }
            })
            .catch(err => {
                console.error("Error fetching expenses:", err);
            });
    }

    // Initial fetch and display of expenses
    fetchAndDisplayExpenses();

    // Handle table row actions
    if (expensesTable) {
        expensesTable.addEventListener("click", async (event) => {
            if (event.target.classList.contains("delete-btn")) {
                const tr = event.target.closest("tr");
                const expenseId = tr.getAttribute("data-id");

                if (confirm("Are you sure you want to delete this expense?")) {
                    try {
                        const response = await fetch(`http://localhost:4000/expenses/${expenseId}`, {
                            method: "DELETE",
                        });

                        if (response.ok) {
                            tr.remove(); // Remove the row from the table if successful
                        } else {
                            alert("Failed to delete the expense.");
                        }
                    } catch (err) {
                        console.error("Error deleting expense:", err);
                        alert("An error occurred. Please try again.");
                    }
                }
            } else if (event.target.classList.contains("edit-btn")) {
                const tr = event.target.closest("tr");
                const expenseId = tr.getAttribute("data-id");
                const amount = prompt("Enter new amount:", tr.children[2].textContent);
                const date = prompt("Enter new date (YYYY-MM-DD):", tr.children[3].textContent);
                const category = prompt("Enter new category:", tr.children[1].textContent);

                if (amount && date && category) {
                    try {
                        const response = await fetch(`http://localhost:4000/expenses/${expenseId}`, {
                            method: "PATCH",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({ amount, date, category }),
                        });

                        if (response.ok) {
                            // Update the row with new values
                            tr.children[1].textContent = category;
                            tr.children[2].textContent = amount;
                            tr.children[3].textContent = new Date(date).toLocaleString(
                                "en-US",
                                { year: "numeric", month: "short", day: "2-digit" }
                            );
                            alert("Expense edited successfully");
                        } else {
                            const result = await response.text();
                            alert(`Error editing expense: ${result}`);
                        }
                    } catch (err) {
                        console.error("Error editing expense:", err);
                        alert("An error occurred. Please try again.");
                    }
                }
            }
        });
    }

    // Call setTodayDate function if required
    setTodayDate();
});
