# All Staff Meetings Hub 🗓️

A comprehensive **two-database Notion system** for managing All Staff meetings with separate databases for meeting logistics and agenda items.

## 🎯 What's New: Two-Database Structure

This system uses **two related Notion databases** for maximum flexibility:

### 1. **Meetings Database** 📅
- Meeting dates and facilitators
- AI meeting notes links
- Meeting status (Upcoming, In Progress, Completed)
- Rollup statistics (# items, # completed)

### 2. **Agenda Items Database** 📝
- Individual discussion topics
- Status tracking (Backlog → To Discuss → In Discussion → Decided/Action Required → Completed)
- Categories, priorities, and owners
- Linked to specific meetings via relations

### Why Two Databases?

**Meeting-Centric View**: Click any meeting to see all its agenda items nested inside
**Flat Item View**: See all agenda items across all meetings with statuses at a glance
**Better Organization**: Separate meeting logistics from discussion topics
**Flexible Filtering**: Archive old meetings without losing access to agenda items
**Smart Rollups**: Track completion statistics automatically

---

## 🚀 Quick Start

You have **two options** for setting up your databases:

### Option 1: Manual Setup (No API Required) ⚡

**Best for**: Getting started immediately without API permissions

1. Open [`MANUAL_SETUP.md`](./MANUAL_SETUP.md)
2. Follow the step-by-step instructions to create both databases
3. Set up the relation between them
4. Configure views

**Time**: ~20-25 minutes

### Option 2: Automated Setup (API Integration) 🤖

**Best for**: Automation, CLI management, and ongoing maintenance

#### Step 1: Install Dependencies

```bash
npm install
```

#### Step 2: Create Notion Integration

1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. **Name**: "All Staff Meetings Manager"
4. **Workspace**: Select "Out in Tech"
5. **Capabilities**: ✅ Read content, Update content, Insert content
6. Copy the "Internal Integration Token" (starts with `secret_...`)

#### Step 3: Share Page with Integration

1. Go to: https://www.notion.so/All-Staff-draft-2e78dac1d83e805fb8c6f28f9b1b456f
2. Click "..." → "Connections"
3. Add your "All Staff Meetings Manager" integration

#### Step 4: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your token:
```env
NOTION_TOKEN=secret_your_actual_token_here
```

#### Step 5: Run Setup

```bash
npm run setup
```

The script will:
- ✅ Create both databases (Meetings & Agenda Items)
- ✅ Set up all properties
- ✅ Create the relation between databases
- ✅ Add rollup properties

#### Step 6: Save Database IDs

Copy the database IDs from the output and add to `.env`:

```env
NOTION_MEETINGS_DATABASE_ID=your_meetings_db_id_here
NOTION_AGENDA_ITEMS_DATABASE_ID=your_agenda_items_db_id_here
```

**Time**: ~5 minutes (after getting API permissions)

---

## 📖 Usage

### CLI Tools (Automated Setup Only)

#### Create a New Meeting

```bash
npm run add-meeting
```

Interactive prompts:
- Meeting name (e.g., "All Staff - Jan 20, 2026")
- Meeting date
- Facilitator (optional)
- Status (Upcoming/In Progress/Completed)
- AI notes URL (optional)

**Example**:
```
📅 Add New Meeting

? Meeting name: All Staff - Jan 20, 2026
? Meeting date (YYYY-MM-DD): 2026-01-20
? Facilitator email (optional):
? Meeting status: Upcoming
? AI Meeting Notes URL (optional):

✅ Meeting created successfully!
```

#### Add Agenda Item

```bash
npm run add-item
```

Interactive prompts:
- Select which meeting
- Agenda item title
- Status
- Categories
- Priority
- Owner/Assignee (optional)
- Decision/Outcome (optional)

**Example**:
```
📝 Add New Agenda Item

? Select meeting: All Staff - Jan 20, 2026 | 2026-01-20 | Upcoming
? Agenda item title: Review Q2 Budget Allocation
? Status: To Discuss
? Categories: Revenue, Internal
? Priority: High
? Owner/Assignee email (optional):
? Decision/Outcome (optional):

✅ Agenda item created successfully!
```

#### Update Item Status

```bash
npm run update-status
```

- Select an item from the list
- Choose new status
- Optionally set completed date
- Add/update decision notes

### Using in Notion (Both Manual & Automated)

#### Before Meetings:

**1. Create a meeting** (Meetings database)
- Click "+ New"
- Set meeting name, date, facilitator

**2. Add agenda items** (Agenda Items database)
- Click "+ New"
- Link to the meeting
- Set status, category, priority

**3. Review agenda** (Use "By Meeting" view)
- See all items for upcoming meeting
- Reorder by priority

#### During Meetings:

**1. Open the meeting page**
- Click meeting in Meetings database
- See all linked agenda items

**2. Update statuses**
- Move items: To Discuss → In Discussion → Decided/Action Required
- Fill in Decision/Outcome
- Assign owners for action items

**3. Link notes**
- Add AI Meeting Notes URL to meeting

#### After Meetings:

**1. Complete the meeting**
- Set meeting status to "Completed"

**2. Finalize items**
- Mark items as Completed or Action Required
- Set Completed Date

**3. Track actions**
- Use "Action Items" view to see what needs follow-up

---

## 🗂️ Database Structure

### Meetings Database

| Property | Type | Description |
|----------|------|-------------|
| **Meeting Name** | Title | Meeting identifier (e.g., "All Staff - Jan 20") |
| **Meeting Date** | Date | When the meeting occurs |
| **Facilitator** | Person | Who leads the meeting |
| **Status** | Select | Upcoming, In Progress, Completed |
| **AI Meeting Notes** | URL | Link to AI-generated summary |
| **Agenda Items** | Relation | Linked agenda items (auto-created) |
| **# Items** | Rollup | Count of total agenda items |
| **# Completed** | Rollup | Count of completed items |

### Agenda Items Database

| Property | Type | Description |
|----------|------|-------------|
| **Agenda Item** | Title | The topic/issue to discuss |
| **Meeting** | Relation | Which meeting this belongs to |
| **Status** | Select | Backlog → To Discuss → In Discussion → Decided → Action Required → Completed |
| **Category** | Multi-select | Topic tags (Internal, Events, etc.) |
| **Priority** | Select | High, Medium, Low |
| **Owner/Assignee** | Person | Who is responsible |
| **Decision/Outcome** | Text | What was decided or accomplished |
| **Completed Date** | Date | When marked complete |

### Database Relationship

```
┌─────────────────┐          ┌──────────────────┐
│    Meetings     │          │  Agenda Items    │
│                 │          │                  │
│ - Meeting Name  │ 1 ←─→ ∞  │ - Agenda Item    │
│ - Meeting Date  │          │ - Meeting (rel)  │
│ - Facilitator   │          │ - Status         │
│ - Status        │          │ - Category       │
│ - AI Notes      │          │ - Priority       │
│ - Agenda Items  │          │ - Owner          │
│   (relation)    │          │ - Decision       │
└─────────────────┘          └──────────────────┘
```

---

## 👁️ Recommended Views

### For Meetings Database:

#### 1. **Timeline** (Default)
- Group by: Status
- Sort by: Meeting Date
- Shows: Upcoming, In Progress, Completed sections

#### 2. **Archive**
- Filter: Status = Completed
- Sort by: Meeting Date (descending)
- Use: Historical reference

### For Agenda Items Database:

#### 1. **All Items** (Default - Flat View)
- Filter: Exclude completed items > 30 days old
- Sort: Priority (High first), then Status
- Use: See everything at a glance

#### 2. **By Status** (Board View)
- Group by: Status
- Use: Kanban-style workflow during meetings

#### 3. **By Meeting**
- Group by: Meeting (relation)
- Filter: Active items only
- Use: See items organized by meeting

#### 4. **Action Items**
- Filter: Status = Action Required or In Discussion
- Sort: Priority
- Use: Track what needs to be done

#### 5. **Archive**
- Filter: Status = Completed or Decided
- Sort: Completed Date (descending)
- Use: Historical reference

---

## 📋 Categories

Your organization uses these categories:

- **Internal** - Internal operations and processes
- **Staff Development** - Team growth and training
- **Events** - Organizational events
- **Institute** - Institute-related matters
- **OIT U** - OIT University program
- **Digital Corps** - Digital Corps initiative
- **Partnership Engagement** - Partner relationships
- **Revenue** - Financial and revenue matters
- **Community** - Community engagement
- **Volunteers** - Volunteer coordination

---

## 🔄 Status Workflows

### Meeting Status:
```
Upcoming → In Progress → Completed
```

### Agenda Item Status:
```
Backlog
   ↓
To Discuss (on upcoming meeting agenda)
   ↓
In Discussion (active in current meeting)
   ↓
├─→ Decided (complete, no action needed)
└─→ Action Required (needs follow-up)
      ↓
   Completed
```

---

## 💡 Best Practices

### Meeting Preparation:
- ✅ Create meeting 1 week in advance
- ✅ Add agenda items throughout the week (Backlog status)
- ✅ Move items to "To Discuss" when finalizing agenda
- ✅ Prioritize high-priority items

### During Meetings:
- ✅ Open the meeting page to see all agenda items
- ✅ Update status in real-time as you progress
- ✅ Capture decisions immediately in Decision/Outcome field
- ✅ Assign owners for action items

### After Meetings:
- ✅ Mark meeting as Completed
- ✅ Link AI meeting notes
- ✅ Set Completed Date on finished items
- ✅ Review Action Items view for follow-ups

### Organization:
- 🏷️ Use multiple categories when relevant
- 🏷️ Set priority to reflect urgency
- 🏷️ Archive happens automatically (30 days after completion)
- 🏷️ Use Meeting relation consistently

### Views:
- 📊 Use "By Meeting" view when planning specific meetings
- 📊 Use "All Items" view for cross-meeting visibility
- 📊 Use "Action Items" view for follow-up tracking
- 📊 Collapse Archive views to reduce clutter

---

## 🛠️ Project Structure

```
notion-staff-meetings-hub/
├── src/
│   ├── config.ts              # Configuration and constants
│   ├── setup-databases.ts     # Creates both databases with relations
│   ├── add-meeting.ts         # CLI: Add new meeting
│   ├── add-item.ts            # CLI: Add agenda item
│   └── update-status.ts       # CLI: Update item status
├── MANUAL_SETUP.md            # Step-by-step manual instructions
├── README.md                  # This file
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── .env.example               # Environment template
└── .gitignore                 # Git ignore rules
```

---

## 🔧 Development

### Build

```bash
npm run build
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run setup` | Create both Notion databases |
| `npm run add-meeting` | Add new meeting (interactive) |
| `npm run add-item` | Add new agenda item (interactive) |
| `npm run update-status` | Update item status (interactive) |

### Environment Variables

Required in `.env`:

```env
NOTION_TOKEN=secret_...                    # Integration token
NOTION_PARENT_PAGE_ID=...                  # Page where databases live
NOTION_WORKSPACE_ID=...                    # Workspace ID
NOTION_MEETINGS_DATABASE_ID=...            # Meetings DB ID (after setup)
NOTION_AGENDA_ITEMS_DATABASE_ID=...        # Agenda Items DB ID (after setup)
```

---

## ❓ Troubleshooting

### "Authentication error"
- ✓ Check `NOTION_TOKEN` in `.env`
- ✓ Verify integration has correct permissions (Read, Update, Insert)
- ✓ Ensure page is shared with integration

### "Page not found"
- ✓ Check `NOTION_PARENT_PAGE_ID` is correct
- ✓ Ensure you have access to the page
- ✓ Share page with integration

### "Database not found"
- ✓ Run `npm run setup` first
- ✓ Add both database IDs to `.env`
- ✓ Verify databases exist in Notion

### "No meetings found" (when adding item)
- ✓ Create a meeting first: `npm run add-meeting`
- ✓ Verify meeting was created in Notion

### "Can't create integration"
- 👉 See [`MANUAL_SETUP.md`](./MANUAL_SETUP.md) for manual setup
- 👉 Contact your Notion workspace admin
- 👉 Request integration creation permissions

---

## 🎯 Key Benefits of Two-Database Structure

### Separation of Concerns:
Meeting logistics (date, facilitator, notes) are separate from discussion topics (status, decisions, actions)

### Flexible Views:
- **Meeting-centric**: "What's on the agenda for Monday's meeting?"
- **Item-centric**: "What's the status of the budget discussion?"
- **Action-centric**: "What needs to be done this week?"

### Better Filtering & Archiving:
- Archive old meetings without losing access to agenda items
- See all active items across multiple meetings
- Track items by status, category, or owner regardless of meeting

### Scalability:
- Add unlimited meetings without cluttering the item list
- One meeting can have many items
- Search and filter across entire history

### Automatic Statistics:
- See how many items per meeting
- Track completion rates
- Identify meetings with outstanding actions

---

## 📚 Resources

- [Notion API Documentation](https://developers.notion.com/)
- [Create Integrations](https://www.notion.so/my-integrations)
- [Notion SDK for JavaScript](https://github.com/makenotion/notion-sdk-js)
- [Database Relations in Notion](https://www.notion.so/help/relations-and-rollups)

---

## 📄 License

MIT

---

## 🎉 You're Ready!

Choose your path:
- **Manual Setup**: Open `MANUAL_SETUP.md` and follow instructions (~20 min)
- **Automated Setup**: Run `npm install` → `npm run setup` (~5 min with API access)

### What You'll Get:

✅ **Meeting-centric organization** - Click any meeting to see its agenda
✅ **Flat item view** - See all items across all meetings
✅ **Status tracking** - Move items through your workflow
✅ **Smart archiving** - Auto-hide old completed items
✅ **Category tagging** - Organize by topic area
✅ **Action tracking** - Never lose track of follow-ups
✅ **Rollup statistics** - See completion rates at a glance

**Happy organizing!** 🚀
