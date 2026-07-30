# Metal Worx OS Blueprint

## Mission

Metal Worx OS is a manufacturing operations platform built to help Metal Worx track every order from customer request to completed product.

The primary goal is to keep the operation flowing, reduce confusion, improve communication, and give the office and shop complete visibility into where every order stands.

## Core Principle

Every feature must support at least one of these goals:

- Save time
- Reduce mistakes
- Improve communication
- Increase visibility

## Core Workflow

Customer
↓
Customer Order
↓
Product / Manufacturing Template
↓
Work Orders
↓
Production Board
↓
Job Traveler
↓
QC
↓
Showroom / Shipping / Installation
↓
Completed

---

# Modules

## Dashboard

Purpose:
Provide a real-time overview of the entire business.

Features:
- Production Summary
- Orders Due Today
- Rush Orders
- Waiting on Customer
- Waiting on Material
- Ready for Pickup
- Notifications
- Shop Activity Feed

---

## Customers

Purpose:
Maintain customer information and history.

Features:
- Customer Search
- Customer Profiles
- Contact Information
- Order History
- Quotes
- Notes
- Uploaded Files

---

## Customer Orders

Purpose:
Create and manage customer orders.

Features:
- Customer Lookup
- Multiple Order Items
- Due Dates
- Deposits
- Status Tracking
- Auto Generate Work Orders
- Timeline
- Files
- Messages

---

## Product Templates

Purpose:
Store repeat products and manufacturing knowledge.

Features:
- Pricing
- Materials
- Workflow
- Estimated Build Time
- Laser Time
- Paint Time
- Powder Coat Time
- Assembly Time
- SOP
- Photos

---

## Work Orders

Purpose:
Individual manufacturing jobs created from customer orders.

Features:
- Job Traveler
- Assigned Workflow
- Files
- Photos
- Conversations
- Timeline
- Production Status

---

## Production Board

Purpose:
Track every active work order through the shop.

Features:
- Dynamic Workflow Columns
- Drag and Drop
- Station Queues
- Due Dates
- Rush Indicators
- Waiting Status
- Job History

---

## Inventory (Future)

Purpose:
Track materials and finished goods.

Features:
- Raw Material
- Hardware
- Consumables
- Stock Levels
- Purchase Orders
- Material Reservations

---

## Operations Center (Future)

Purpose:
Communication and operational awareness.

Features:
- Notifications
- Job Conversations
- Help Requests
- Announcements
- Activity Feed
- Approvals
- Mentions

---

## Reports

Purpose:
Business analytics and reporting.

Features:
- Sales
- Production
- Employee Productivity
- Inventory
- Financial

---

# Database Relationships

## Core Relationship

Customer
↓
Customer Order
↓
Customer Order Items
↓
Work Orders / Jobs
↓
Job History

## Current Tables

### customers
Stores customer contact information.

### customer_orders
Stores the main order record.

### customer_order_items
Stores each item inside a customer order.

### jobs
Stores production work orders.

### job_history
Stores movement and status history for each job.

### product_templates
Stores repeat products and manufacturing templates.

### work_centers
Stores shop stations and departments.

### workflow_templates
Stores workflow steps for each job type or template.

## Future Tables

### files
Stores uploaded DXF, SVG, PDF, photos, and reference images.

### notifications
Stores alerts, questions, approvals, and help requests.

### employees
Stores team members and roles.

### inventory_items
Stores raw materials, hardware, consumables, and finished goods.

### activity_feed
Stores major system events.

---

# Metal Worx Operating Philosophy

1. Every order starts with a customer.
2. One customer can have many customer orders.
3. One customer order can contain multiple work orders.
4. Every work order should have a digital job traveler.
5. Every work order should know its current station.
6. Every work order should keep its full history.
7. Product templates should reduce repetitive typing.
8. Communication should stay attached to the work order or customer order.
9. The system should show what needs attention before someone has to ask.
10. The goal is to keep work moving from start to complete.

---

# Metal Worx Development Rules

## Rule 1
The application should guide the user instead of requiring the user to remember the process.

## Rule 2
Every piece of information should have one source of truth.

Example:
Customer phone numbers only exist in the Customer record.

## Rule 3
Every major record should have a Detail page.

Examples:
- Customer
- Customer Order
- Work Order
- Product Template
- Employee
- Inventory Item

## Rule 4
Every action should be tracked automatically.

Examples:
- Created
- Edited
- Approved
- Moved
- Completed
- Rejected

## Rule 5
No duplicate data whenever possible.

If information already exists, reference it instead of typing it again.

## Rule 6
Communication belongs with the work.

Questions, approvals, photos, and notes should always be attached to the related Customer Order or Work Order.

## Rule 7
Automation over manual entry.

The software should fill in as much information as possible using Product Templates, Customers, and Workflows.

## Rule 8
Every screen should answer one primary question.

Dashboard:
"What needs attention?"

Customer:
"Who are they?"

Customer Order:
"What did they order?"

Work Order:
"What are we building?"

Production Board:
"Where is it?"

Inventory:
"Do we have what we need?"

Reports:
"How are we performing?"

---

# The Metal Worx Difference

Metal Worx OS is designed around the real workflow of a fabrication shop.

Instead of forcing the shop to adapt to software, the software adapts to the shop.

Core ideas:

- Digital Job Folder instead of paper folders.
- Customer Orders that automatically generate Work Orders.
- Manufacturing Templates that eliminate repetitive typing.
- Dynamic Production Boards driven by workflows.
- Conversations attached directly to the work.
- Notifications that require action, not just messages.
- Complete visibility from customer request to delivery.
- Every workstation sees only the information it needs.
- Every action creates a permanent timeline entry.

---

# Shop Workflow

## Standard Product Workflow

Customer
↓
Customer Order
↓
Select Product Template
↓
Generate Work Orders
↓
Production
↓
Quality Control
↓
Showroom / Shipping
↓
Completed

---

## Custom Product Workflow

Customer
↓
Customer Order
↓
Design Consultation
↓
Artwork Approval
↓
Generate Work Orders
↓
Production
↓
Quality Control
↓
Customer Approval (if required)
↓
Completed

---

## Fabrication Workflow

Customer
↓
Site Visit (if needed)
↓
Estimate / Quote
↓
Customer Approval
↓
Engineering / Design
↓
Material Ordering
↓
Fabrication
↓
Welding
↓
Finishing
↓
Installation
↓
Completed

# Product Categories

Military Awards

Battle Worn Flags

Retirement Gifts

Signs

Business Branding

Monograms

Custom Art

Fabrication

Railings

Gates

Repairs

Powder Coating

Installation
