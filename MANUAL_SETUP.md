# Manual Setup Guide: All Staff Meetings Hub (Two-Database Structure)

This guide will walk you through creating your All Staff Meetings system with **two related databases** directly in Notion without needing API access.

## 🎯 Overview

You'll create a two-database system:

1. **Meetings Database** - Meeting-level information (date, facilitator, notes)
2. **Agenda Items Database** - Individual topics with status tracking

These databases are **linked via relations**, giving you:
- Meeting-centric view: See each meeting with all its agenda items
- All-items view: Flat list of every item across all meetings with statuses
- Smart filtering and rollups

---

## 📋 Step 1: Create the Meetings Database

1. Go to your page: https://www.notion.so/All-Staff-draft-2e78dac1d83e805fb8c6f28f9b1b456f
2. Scroll to where you want the databases
3. Type `/database` and select **"Database - Inline"**
4. Name it: **"All Staff Meetings"**

### Properties for Meetings Database:

Delete all default properties except "Name", then set up these properties:

#### 1. **Meeting Name** (Title - already exists)
   - This is the main identifier (e.g., "All Staff - Jan 20, 2026")

#### 2. **Meeting Date** (Date)
   - Add property → "Date"
   - Name: **"Meeting Date"**
   - When the meeting occurs

#### 3. **Facilitator** (Person)
   - Add property → "Person"
   - Name: **"Facilitator"**
   - Who leads the meeting

#### 4. **Status** (Select)
   - Add property → "Select"
   - Name: **"Status"**
   - Add these options:
     - 🔵 **Upcoming** (Blue)
     - 🟡 **In Progress** (Yellow)
     - 🟢 **Completed** (Green)

#### 5. **AI Meeting Notes** (URL)
   - Add property → "URL"
   - Name: **"AI Meeting Notes"**
   - Link to your AI-generated notes

#### 6. **Agenda Items** (Relation - will be added from the other side)
   - This will be automatically created when you set up the Agenda Items database

---

## 📝 Step 2: Create the Agenda Items Database

1. Below the Meetings database, type `/database` again
2. Select **"Database - Inline"**
3. Name it: **"Agenda Items"**

### Properties for Agenda Items Database:

#### 1. **Agenda Item** (Title)
   - Rename "Name" to: **"Agenda Item"**
   - The topic/issue to discuss

#### 2. **Meeting** (Relation) ⭐ IMPORTANT
   - Add property → "Relation"
   - Name: **"Meeting"**
   - **Select the "All Staff Meetings" database** you just created
   - ✅ Check "Show on All Staff Meetings"
   - For "Property name on All Staff Meetings", enter: **"Agenda Items"**
   - Click "Add relation"

   This creates the two-way link between databases!

#### 3. **Status** (Select)
   - Add property → "Select"
   - Name: **"Status"**
   - Add these options:
     - 🔵 **Backlog** (Gray)
     - 📝 **To Discuss** (Blue)
     - 💬 **In Discussion** (Yellow)
     - ✅ **Decided** (Green)
     - 🎯 **Action Required** (Orange)
     - ✔️ **Completed** (Purple)

#### 4. **Category** (Multi-select)
   - Add property → "Multi-select"
   - Name: **"Category"**
   - Add these tags:
     - Internal
     - Staff Development
     - Events
     - Institute
     - OIT U
     - Digital Corps
     - Partnership Engagement
     - Revenue
     - Community
     - Volunteers

#### 5. **Priority** (Select)
   - Add property → "Select"
   - Name: **"Priority"**
   - Options:
     - 🔴 High (Red)
     - 🟡 Medium (Yellow)
     - 🟢 Low (Green)

#### 6. **Owner/Assignee** (Person)
   - Add property → "Person"
   - Name: **"Owner/Assignee"**
   - Who is responsible for this item

#### 7. **Decision/Outcome** (Text)
   - Add property → "Text"
   - Name: **"Decision/Outcome"**
   - What was decided or what action was taken

#### 8. **Completed Date** (Date)
   - Add property → "Date"
   - Name: **"Completed Date"**
   - When the item was marked complete

---

## 🔗 Step 3: Add Rollups to Meetings Database (Optional but Recommended)

Go back to your **Meetings database** and add these rollup properties to get summary statistics:

#### **# Items** (Rollup)
   - Add property → "Rollup"
   - Name: **"# Items"**
   - Relation: Select "Agenda Items"
   - Property: Select "Agenda Item"
   - Calculate: **Count all**

   This shows the total number of agenda items for each meeting.

#### **# Completed** (Rollup)
   - Add property → "Rollup"
   - Name: **"# Completed"**
   - Relation: Select "Agenda Items"
   - Property: Select "Status"
   - Calculate: **Count values** → Select "Completed"

   This shows how many items are completed for each meeting.

---

## 👁️ Step 4: Create Views

### For MEETINGS Database:

#### View 1: **"Timeline"** (Timeline or Table - Default)

1. Keep the default table view or switch to Timeline
2. Name: **"Timeline"**
3. **Group by**: Status (shows Upcoming, In Progress, Completed sections)
4. **Sort**: Meeting Date → Ascending
5. **Filter** (optional):
   - Meeting Date → Is on or after → 30 days ago
   (This hides old completed meetings)

This view lets you see each meeting as a card, and when you open it, you'll see all the linked agenda items inside!

#### View 2: **"Archive"** (Table)

1. Add view → "Table"
2. Name: **"Archive"**
3. **Filter**:
   - Status → Is → Completed
4. **Sort**: Meeting Date → Descending
5. Keep collapsed by default

### For AGENDA ITEMS Database:

#### View 1: **"All Items"** (Table - Default)

This is your main flat view of all agenda items across all meetings.

1. Default table view
2. Name: **"All Items"**
3. **Filter**:
   - Status → Is not → Completed
   - OR
   - Completed Date → Is within → Past 30 days
4. **Sort**:
   - Priority → Descending (High first)
   - Status → Ascending
5. **Group by** (optional): Meeting or Status

#### View 2: **"By Status"** (Board)

Kanban-style view.

1. Add view → "Board"
2. Name: **"By Status"**
3. **Group by**: Status
4. **Filter**:
   - Status → Is not → Completed
5. **Sort**: Priority → Descending

#### View 3: **"By Meeting"** (Table)

See items organized by meeting.

1. Add view → "Table"
2. Name: **"By Meeting"**
3. **Group by**: Meeting
4. **Filter**:
   - Status → Is not → Completed
5. **Sort**: Priority → Descending

#### View 4: **"Action Items"** (Table)

Track what needs to be done.

1. Add view → "Table"
2. Name: **"Action Items"**
3. **Filter**:
   - Status → Is → Action Required
   - OR
   - Status → Is → In Discussion
4. **Sort**: Priority → Descending
5. **Properties shown**:
   - Agenda Item
   - Meeting (relation)
   - Status
   - Priority
   - Owner/Assignee
   - Decision/Outcome

#### View 5: **"Archive"** (Table)

Completed items.

1. Add view → "Table"
2. Name: **"Archive"**
3. **Filter**:
   - Status → Is → Completed
   - OR
   - Status → Is → Decided
4. **Sort**: Completed Date → Descending

---

## 🎨 Step 5: Organize the Page

### Recommended Layout:

1. **Top section**: Meetings database
   - Set to "Timeline" or "Table" view
   - This shows your meeting schedule
   - Click any meeting to see its linked agenda items

2. **Bottom section**: Agenda Items database
   - Set to "All Items" or "By Status" view
   - This gives you the flat view of all items
   - Filter, search, and manage items across all meetings

### Make It Readable:

- **Collapse Archive views** by default
- **Adjust column widths**: Make "Agenda Item" and "Meeting Name" wider
- **Hide less important properties**: Use view settings to show only key fields
- **Add descriptions** to each view explaining its purpose

---

## 📝 Step 6: Using the Two-Database System

### Creating a New Meeting:

1. Go to **Meetings database**
2. Click "+ New"
3. Fill in:
   - Meeting Name: "All Staff - [Date]"
   - Meeting Date: The date
   - Facilitator: Select person
   - Status: Upcoming

### Adding Agenda Items:

1. Go to **Agenda Items database**
2. Click "+ New"
3. Fill in:
   - Agenda Item: Topic name
   - **Meeting**: Select which meeting (IMPORTANT!)
   - Status: To Discuss or Backlog
   - Category: Relevant tags
   - Priority: High/Medium/Low

### Viewing Items by Meeting:

**Option A**: Open a meeting page
- Click any meeting in the Meetings database
- Scroll to see "Agenda Items" section
- All linked items are listed there

**Option B**: Use the "By Meeting" view
- Go to Agenda Items database
- Switch to "By Meeting" view
- Items are grouped by their meeting

### Viewing All Items Flat:

- Go to Agenda Items database
- Use "All Items" view
- See every item across all meetings with statuses
- Filter, sort, and search as needed

### During Meetings:

1. Open the meeting page from Meetings database
2. See all agenda items for that meeting
3. Update status: To Discuss → In Discussion → Decided/Action Required
4. Fill in Decision/Outcome
5. Assign Owner/Assignee for action items
6. Add link to AI Meeting Notes (on the meeting page)

### After Meetings:

1. Update meeting status to "Completed"
2. Mark agenda items as "Completed" or "Action Required"
3. Set Completed Date for closed items
4. Items automatically archive after 30 days

---

## 💡 Benefits of This Structure

### Separation of Concerns:
- **Meeting logistics** (date, facilitator) live in Meetings DB
- **Discussion topics** (items, statuses) live in Agenda Items DB
- Clean, organized, no duplication

### Flexible Views:
- **Meeting-centric**: "What's on the agenda for Monday?"
- **Item-centric**: "What's the status of the budget discussion?"
- **Action-centric**: "What needs to be done?"

### Better Filtering:
- Archive old meetings without losing access to items
- See all "In Discussion" items across all meetings
- Track action items by owner/assignee

### Scalability:
- Add unlimited meetings without cluttering item list
- One meeting can have many items
- Search and filter across entire history

---

## 🎯 Workflow Example

### Week Before Meeting:

1. Create new meeting in Meetings DB
2. Add agenda items in Agenda Items DB, link to meeting
3. Use "By Meeting" view to review what's scheduled

### During Meeting:

1. Open meeting page
2. Work through agenda items in order
3. Update statuses as you go
4. Capture decisions in Decision/Outcome field
5. Assign action items to owners

### After Meeting:

1. Mark meeting as "Completed"
2. Link AI meeting notes to meeting
3. Check "Action Items" view for follow-ups
4. Items auto-archive after 30 days once completed

---

## 🚀 Quick Reference

### Status Workflow for Agenda Items:
```
Backlog → To Discuss → In Discussion → Decided/Action Required → Completed
```

### Status Workflow for Meetings:
```
Upcoming → In Progress → Completed
```

### Key Relations:
```
Meetings (1) ←→ (Many) Agenda Items
```

### Best Views:
- **Meetings**: Timeline (group by status)
- **Agenda Items**: All Items (flat list) or By Status (board)

---

## ❓ Need Help?

If you want to automate this with the API integration:
1. Create a Notion integration at https://www.notion.so/my-integrations
2. Share both databases with the integration
3. Run the automated setup script (see README.md)

---

## 🎉 You're Done!

Your two-database All Staff Meetings Hub is ready! This structure gives you:

- ✅ Meeting-centric organization
- ✅ Flat item list across all meetings
- ✅ Flexible filtering and views
- ✅ Clean separation of meeting logistics and discussion topics
- ✅ Smart archiving and rollup statistics

Start by creating your next meeting and adding a few agenda items!
