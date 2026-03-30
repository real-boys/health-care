# Healthcare Mobile App

A comprehensive React Native mobile application for the Healthcare Drips platform with full feature parity and mobile-specific optimizations.

## Features

### 🏥 Provider Directory
- **Search & Filters**: Find healthcare providers by specialty, location, rating, and availability
- **Provider Profiles**: Detailed information including education, experience, services, and insurance
- **Real-time Availability**: View and book available appointment slots
- **Reviews & Ratings**: Read and write provider reviews

### 📅 Appointment Management
- **Easy Booking**: Step-by-step appointment booking process
- **Calendar Integration**: View upcoming and past appointments
- **Reminders**: Push notifications for appointment reminders
- **Reschedule & Cancel**: Manage appointments on the go

### 💳 Payment System
- **Secure Payments**: Multiple payment methods including insurance
- **Premium Drips**: Manage recurring premium payments
- **Payment History**: Track all healthcare expenses
- **Insurance Integration**: Link insurance providers for automatic claims

### 🔐 Security & Authentication
- **Biometric Login**: Fingerprint and Face ID support
- **Secure Storage**: Encrypted credential storage
- **Two-Factor Authentication**: Enhanced security with 2FA
- **Session Management**: Automatic logout and session control

### 📱 Mobile-Specific Features
- **Offline Support**: Access key features without internet
- **Push Notifications**: Real-time updates for appointments and payments
- **Camera Integration**: Scan documents and insurance cards
- **Location Services**: Find nearby healthcare providers
- **Voice Commands**: Hands-free operation for accessibility

## Technology Stack

- **React Native**: Cross-platform mobile development
- **Redux Toolkit**: State management
- **React Navigation**: Navigation and routing
- **React Native Paper**: Material Design components
- **React Native Biometrics**: Biometric authentication
- **React Native Maps**: Location services
- **React Native Camera**: Document scanning
- **React Native Push Notification**: Real-time notifications
- **Ethers.js**: Blockchain integration
- **Axios**: API communication

## Installation

```bash
# Clone the repository
git clone https://github.com/OsejiFabian/health-care.git
cd health-care/mobile

# Install dependencies
npm install

# For iOS
cd ios && pod install && cd ..

# Run the app
npm run android    # For Android
npm run ios        # For iOS
```

## Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
API_BASE_URL=https://api.healthcare.com
METAMASK_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
PUSH_NOTIFICATION_KEY=YOUR_PUSH_NOTIFICATION_KEY
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_KEY
```

### Android Setup
1. Update `android/app/build.gradle` with your configuration
2. Set up Google Maps API key in `android/app/src/main/AndroidManifest.xml`
3. Configure push notification settings

### iOS Setup
1. Update `ios/HealthcareMobile/Info.plist` with required permissions
2. Set up push notification certificates
3. Configure biometric permissions

## App Structure

```
src/
├── components/          # Reusable UI components
├── screens/             # Screen components
│   ├── auth/           # Authentication screens
│   ├── dashboard/      # Dashboard screen
│   ├── providers/      # Provider directory screens
│   ├── appointments/   # Appointment screens
│   ├── payments/       # Payment screens
│   ├── profile/        # Profile screen
│   ├── records/        # Medical records screen
│   ├── booking/        # Booking screens
│   └── notifications/  # Notification screens
├── store/              # Redux store
│   └── slices/         # Redux slices
├── utils/              # Utility functions
├── services/           # API services
└── constants/          # App constants
```

## Key Features Implementation

### Provider Directory
- Advanced filtering by specialty, rating, location, and availability
- Real-time search with debouncing
- Provider profiles with comprehensive information
- One-tap appointment booking

### Appointment Booking
- Multi-step booking process with progress indicator
- Real-time availability checking
- Calendar integration
- Payment integration

### Payment System
- Multiple payment methods (credit card, insurance, crypto)
- Premium drip management
- Payment history and receipts
- Insurance claim processing

### Security Features
- Biometric authentication (fingerprint, Face ID)
- Secure credential storage using React Native Keychain
- Session timeout and automatic logout
- Data encryption at rest and in transit

## Performance Optimizations

- **Lazy Loading**: Components and screens loaded on demand
- **Image Optimization**: Cached and compressed images
- **Network Optimization**: Request deduplication and caching
- **Memory Management**: Proper cleanup and memory leak prevention
- **Animation Performance**: Optimized animations using React Native Reanimated

## Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

## Build & Deployment

### Development Build
```bash
npm run build:android
npm run build:ios
```

### Production Build
```bash
npm run build:android:release
npm run build:ios:release
```

### App Store Deployment
1. Build release version
2. Update app metadata
3. Upload to App Store / Google Play
4. Submit for review

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Contact the development team
- Check the documentation

---

**Healthcare Drips Mobile** - Your health in your hands.
