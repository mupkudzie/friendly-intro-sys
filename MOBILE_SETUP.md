# Mobile App Setup Instructions

This app is now configured with Capacitor for native mobile features including:
- 📷 Camera access for photo verification
- 📍 GPS geolocation for geofencing
- 📊 Motion sensors for activity tracking
- 💬 Real-time task comments
- 📝 Task request functionality

## Project Structure

### Mobile Application (Students & Workers)
- Mobile-optimized dashboard with task management
- Location verification before starting tasks
- Photo capture for work verification
- Real-time activity tracking
- Task comments and collaboration
- Request additional tasks

### Web Application (Supervisors & Administrators)
- Full task assignment and management
- Worker activity monitoring
- Task approval workflow
- Analytics and reporting

Both applications connect to the same Supabase database.

## Testing on Physical Device/Emulator

### Prerequisites
1. Export project to GitHub (use "Export to Github" button)
2. Clone the repository to your local machine
3. Run `npm install`

### iOS Setup (Mac required)
1. Add iOS platform: `npx cap add ios`
2. Update dependencies: `npx cap update ios`
3. Build the project: `npm run build`
4. Sync with native platform: `npx cap sync`
5. Open in Xcode: `npx cap run ios`

### Android Setup
1. Add Android platform: `npx cap add android`
2. Update dependencies: `npx cap update android`
3. Build the project: `npm run build`
4. Sync with native platform: `npx cap sync`
5. Open in Android Studio: `npx cap run android`

## Mobile Features for Workers & Students

### Dashboard
1. View all assigned tasks with status indicators
2. See task statistics (total hours, completed tasks, active tasks)
3. Quick access to task requests

### Task Management
1. **View Tasks**: See all assigned tasks with:
   - Priority indicators (color-coded borders)
   - Status badges
   - Location and estimated hours
   - Due dates

2. **Task Details**: Tap any task to see:
   - Full description and instructions
   - Location and deadline information
   - Real-time comments section
   - Task history

3. **Comments & Collaboration**:
   - Add comments on any task
   - Real-time updates when others comment
   - See who posted each comment and when

4. **Request Tasks**:
   - Browse available task templates
   - Submit custom task requests
   - Provide justification for new work

### Starting a Task (Workers Only)
1. Navigate to "My Tasks" tab
2. Click "Start Task" on any pending task
3. **Location Verification**: The app will verify you're at the work site (within geofence radius)
4. **Photo Verification**: Take 2-3 photos of the work area before starting
5. Task automatically starts tracking time and activity

### Activity Tracking
- While working, the app monitors your movement using accelerometer
- Activity levels: Idle, Light, Moderate, Active
- Data logged every 5 minutes to the database

### Completing Tasks
1. Click "Work Completed" when finished
2. Take 2-3 photos of completed work
3. Submit for supervisor approval

## Database Changes
New tables added:
- `activity_logs`: Stores sensor data and photo URLs
- `task_comments`: Real-time task comments and collaboration
- `task-photos` storage bucket: Stores all task verification photos

New columns on `tasks` table:
- `geofence_lat`: Latitude of work site
- `geofence_lon`: Longitude of work site  
- `geofence_radius`: Allowed distance from work site (default: 100m)

## User Roles
The app supports different roles with different access levels:
- **Students**: Mobile-optimized worker interface
- **Garden Workers**: Mobile-optimized worker interface
- **Supervisors**: Web interface for task management and approval
- **Administrators**: Web interface with full system access

## Hot Reload During Development
The app is configured to connect to your Lovable sandbox for hot reload:
```
https://107dcc2f-96e9-4401-96b6-f567985d3930.lovableproject.com
```

After making changes in Lovable:
1. Git pull the latest changes
2. Run `npx cap sync` to update the native app

## Required Permissions
The app will request:
- 📷 Camera access (for photo verification)
- 📍 Location access (for geofencing)
- 📊 Motion sensors (for activity tracking)

Make sure to grant these permissions when prompted on first use.

## Learn More
- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Lovable Mobile Guide](https://docs.lovable.dev/tips-tricks/mobile-apps)
