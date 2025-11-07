# Project Manager Mobile App

A cross-platform mobile application for project management, built with React Native and Expo.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd project_manager_Mobile_v2/frontEnd
npm install
```

### 2. Create Environment File
```bash
# Copy the template
cp env.template .env

# Edit .env and add your Firebase configuration
# See SETUP_INSTRUCTIONS.md for details
```

### 3. Run the App
```bash
npx expo start
```

Then scan the QR code with:
- **iOS**: Camera app or Expo Go app
- **Android**: Expo Go app

## 📱 Current Status

### ✅ Working Features
- Custom bottom tab navigation (Home, Projects, Profile)
- Project listing with real API data
- Project details view
- Scrollable screens with pull-to-refresh
- Client login (no Firebase needed)
- Black and yellow color scheme

### ⚠️ Requires Setup
- **Email/Password Login**: Needs Firebase configuration in `.env`
- **Google Sign-In**: Currently disabled (requires OAuth setup)

### 🔧 In Development
- Task management within projects
- Form submissions
- File attachments
- Push notifications

## 🆘 Having Issues?

### Firebase not initialized error?
1. Create `.env` file from template: `cp env.template .env`
2. Add Firebase config (see `SETUP_INSTRUCTIONS.md`)
3. Restart: `npx expo start --clear`

### Google Sign-In error?
- Google Sign-In is currently disabled
- Use email/password login instead
- See `TROUBLESHOOTING.md` for OAuth setup

### App won't load?
```bash
# Clean reinstall
rm -rf node_modules
npm install
npx expo start --clear
```

## 📚 Documentation

- **[SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md)** - First-time setup guide
- **[AUTH_SETUP.md](./AUTH_SETUP.md)** - Authentication configuration
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues and fixes

## 🧪 Testing Without Firebase

You can test the app without setting up Firebase:

1. Click **"Client Login"** on the login screen
2. Enter any project name/ID
3. Browse the app (limited functionality)

## 🏗️ Architecture

### Tech Stack
- **React Native** with Expo SDK 54
- **Navigation**: Custom bottom tab navigation
- **State**: React Context API
- **API**: REST API with bearer token auth
- **Storage**: AsyncStorage for persistence

### Project Structure
```
src/
├── api/           # API integration
├── screens/       # App screens
│   ├── auth/      # Login screens
│   ├── dashboard/ # Home/Profile
│   └── projects/  # Projects & details
├── utils/         # Utilities & contexts
└── navigation/    # Navigation setup
```

## 🔑 Environment Variables

Required in `.env`:
```bash
BEARER_TOKEN=              # Backend API token
FIREBASE_API_KEY=          # Firebase config
FIREBASE_AUTH_DOMAIN=      # Firebase config
FIREBASE_PROJECT_ID=       # Firebase config
# ... (see env.template for full list)
```

## 📝 Development

### Running on Device
1. Install Expo Go app on your phone
2. Run `npx expo start`
3. Scan QR code with your phone

### Running on Emulator
```bash
# iOS Simulator (Mac only)
npx expo start --ios

# Android Emulator
npx expo start --android
```

## 🐛 Debugging

View logs:
```bash
# In Expo
Press 'j' to open debugger
Press 'r' to reload
Press 'm' to toggle menu
```

Check errors:
1. Look at terminal console
2. Check phone for error overlay
3. Review `TROUBLESHOOTING.md`

## 🔐 Security Notes

- Never commit `.env` file (it's in `.gitignore`)
- Keep Firebase config and bearer tokens secret
- Use environment variables for all sensitive data

## 📱 Platform Support

- ✅ iOS 13+
- ✅ Android 6.0+
- ⚠️ Web (limited support via Expo)

## 🚧 Next Steps

1. Set up your `.env` file
2. Test email/password login
3. Browse projects and tasks
4. Report any issues

For detailed setup instructions, see **[SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md)**

