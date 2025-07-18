# VSCode Debugging Guide for PhotoVision

Your debugging configuration has been updated with the following improvements:

## Key Changes Made

1. **Fixed Nodemon Configuration**: The "Launch Server (Nodemon)" now properly uses nodemon as the runtime executable with the --inspect flag in the correct location.

2. **Added Source Map Support**: All configurations now include source map support for better debugging experience.

3. **Removed Conflicting Runtime Args**: The --inspect runtime argument has been removed from test configurations to prevent conflicts with VSCode's built-in debugger.

4. **Added "Nodemon: Attach" Configuration**: New configuration for attaching to an already running nodemon process.

## Additional Improvements Made

5. **Fixed Chrome Debugger Configurations**: Added proper `webRoot` and `sourceMapPathOverrides` to ensure frontend debugging works correctly with source maps.

6. **Added Compound Configuration**: "Full Stack: Server + Chrome" launches both the server (with nodemon) and Chrome debugger simultaneously for full-stack debugging.

## How to Use Each Configuration

### 1. Launch Server
- **Purpose**: Debug server.js directly without auto-restart
- **How to use**:
  1. Set breakpoints in your server code
  2. Press F5 or go to Run → Start Debugging
  3. Select "Launch Server"
  4. The debugger will stop at your breakpoints

### 2. Launch Server (Nodemon)
- **Purpose**: Debug with auto-restart on file changes
- **How to use**:
  1. Set breakpoints in your code
  2. Select "Launch Server (Nodemon)" and start debugging
  3. When you save changes, nodemon will restart and reconnect the debugger
  4. Your breakpoints will persist across restarts

### 3. Nodemon: Attach
- **Purpose**: Attach to an already running nodemon process
- **How to use**:
  1. If nodemon is already running (npm run dev), stop it first
  2. Start nodemon with debug flag: `nodemon --inspect server.js`
  3. Select "Nodemon: Attach" configuration
  4. VSCode will attach to the running process

### 4. Debug Current Test File
- **Purpose**: Debug any test file you have open
- **How to use**:
  1. Open a test file (e.g., test-api-key.js)
  2. Set breakpoints in the test code
  3. Select "Debug Current Test File" and start debugging
  4. It will run and debug the currently open file

### 5. Specific Test Debuggers
- **Available for**: SmugMug Connection, API Key, Batch Processing
- **How to use**: Select the specific test configuration for quick access

### 6. Chrome Debuggers
- **Purpose**: Debug frontend JavaScript with proper source mapping
- **How to use**:
  1. Start your server first (with or without debugging)
  2. Select either Chrome configuration
  3. Chrome will launch with DevTools connected to VSCode
  4. Breakpoints in your frontend JavaScript files will work correctly

### 7. Full Stack: Server + Chrome (Compound)
- **Purpose**: Debug both backend and frontend simultaneously
- **How to use**:
  1. Select "Full Stack: Server + Chrome" from the debug dropdown
  2. Both the server (with nodemon) and Chrome will launch
  3. Set breakpoints in both backend and frontend code
  4. Debug your full application stack at once

## Tips for Effective Debugging

1. **Setting Breakpoints**:
   - Click in the gutter next to line numbers
   - Use conditional breakpoints (right-click → Add Conditional Breakpoint)
   - Use logpoints for non-breaking logging (right-click → Add Logpoint)

2. **Debug Console**:
   - Use the Debug Console to evaluate expressions while paused
   - Access variables in the current scope
   - Execute JavaScript in the context of your application

3. **Call Stack**:
   - View the call stack to understand how you reached the current breakpoint
   - Click on different stack frames to inspect their variables

4. **Variables Panel**:
   - Inspect local and global variables
   - Watch specific expressions
   - Modify variable values while debugging

5. **For Nodemon Development**:
   - Since your app already uses nodemon, the "Launch Server (Nodemon)" configuration is ideal
   - It maintains breakpoints across restarts
   - Perfect for rapid development with debugging

## Common Issues & Solutions

1. **Breakpoints Not Hit**:
   - Ensure source maps are enabled (already done)
   - Check that the file path matches exactly
   - Try setting breakpoints after the debugger has started

2. **Port Already in Use**:
   - If you see "address already in use", kill the existing process
   - Use: `lsof -i :3001` to find the process
   - Kill it with: `kill -9 <PID>`

3. **Nodemon Not Found**:
   - Ensure nodemon is installed globally: `npm install -g nodemon`
   - Or use the local installation: already configured in your setup

## Quick Start

For your typical development workflow:
1. Use "Launch Server (Nodemon)" for backend debugging with auto-restart
2. Set breakpoints in your code
3. The debugger will stop at breakpoints and reconnect after file changes
4. Use Chrome debugger configurations for frontend debugging
