# Firebase Integration Setup Guide

## Overview
This guide will help you set up Firebase Admin SDK integration for real-time sync between your Electron app and the web mirror.

## Prerequisites
- Firebase project already created (`my-students-mirror`)
- Web mirror deployed and working
- Electron app running locally

## Step 1: Create Firebase Service Account

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select your project**: `my-students-mirror`
3. **Navigate to Project Settings** (gear icon)
4. **Click on "Service accounts" tab**
5. **Click "Generate new private key"**
6. **Download the JSON file**
7. **Rename it to**: `firebase-service-account.json`
8. **Place it in your Electron app root directory**: 
   ```
   My Students Track/
   ├── firebase-service-account.json  ← Place here
   ├── package.json
   ├── electron.js
   └── ...
   ```

## Step 2: Verify Integration

The following files have been created/modified:

### ✅ Created Files:
- `lib/firebaseSync.ts` - Firebase sync module
- `.gitignore` - Protects credentials from git
- `.env.example` - Environment variable template

### ✅ Modified Files:
- `lib/storage.ts` - Added Firestore sync calls

## Step 3: Test the Integration

1. **Start your Electron app**
2. **Add/edit a student** - Check console for sync messages
3. **Check Firestore Console**:
   - Go to Firebase Console → Firestore Database
   - Look for collections: `students`, `transferredStudents`, `pendingPromoted`, `settings`
4. **Check web mirror** - Should show real-time updates

## Step 4: Firestore Collections Structure

Your data will be synced to these collections:

```
Firestore Database:
├── students/
│   ├── {studentId} → Student data + lastUpdated timestamp
├── transferredStudents/
│   ├── {studentId} → Transferred student data + lastUpdated
├── pendingPromoted/
│   ├── {studentId} → Pending promoted data + lastUpdated
├── settings/
│   ├── appSettings → App settings + lastUpdated
└── expenses/
    ├── {expenseId} → Expense data + lastUpdated
```

## Troubleshooting

### Error: "Cannot find module '../firebase-service-account.json'"
- Ensure the JSON file is in the correct location
- Check the filename matches exactly: `firebase-service-account.json`

### Error: "Failed to initialize Firebase Admin SDK"
- Verify the JSON file contains valid Firebase credentials
- Check project ID matches your Firebase project

### No data appearing in Firestore
- Check Electron app console for error messages
- Verify Firestore rules allow writes
- Ensure Firebase project has Firestore enabled

## Security Notes

- ✅ `firebase-service-account.json` is gitignored
- ✅ Credentials won't be committed to version control
- ✅ Web mirror uses client SDK (read-only)
- ✅ Electron app uses Admin SDK (write access)

## Next Steps

Once setup is complete:
1. Test real-time sync between Electron app and web mirror
2. Monitor Firestore usage in Firebase Console
3. Consider setting up Firestore security rules if needed
