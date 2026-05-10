# zipX - Pharmaceutical Distribution Management System

A sponsored comprehensive multi-platform application for managing pharmaceutical distribution operations, including order management, credit tracking, and real-time synchronization across mobile, web, and desktop platforms.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-ISC-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Web%20%7C%20Android-lightgrey.svg)

## 🌟 Features

- **Multi-Platform Support**: Desktop (Windows), Web, and Mobile (APK)
- **Real-Time Data Sync**: All platforms share the same cloud database
- **Order Management**: Create, track, and manage stockist orders
- **Credit System**: Track and manage credit transactions
- **Chemist Logs**: Monitor chemist activities and deliveries
- **Monthly Sheets**: Generate monthly reports and summaries
- **Role-Based Access**: Admin and Agent roles with different permissions
- **Status Tracking**: Track orders through multiple stages (Pending → Purchased → Out for Delivery → Delivered → Collected)

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│     Cloud Backend (Render.com)          │
│   https://zipx-app.onrender.com         │
│                                         │
│  • Node.js + Express API                │
│  • MongoDB Atlas Database               │
│  • JWT Authentication                   │
└─────────────────────────────────────────┘
              ▲
              │
    ┌─────────┼─────────┐
    │         │         │
┌───▼───┐ ┌───▼───┐ ┌───▼────┐
│  APK  │ │  Web  │ │Desktop │
│Mobile │ │Browser│ │  .exe  │
└───────┘ └───────┘ └────────┘
```

## 📦 Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js v5.2.1
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: bcryptjs for password hashing

### Frontend
- **Vanilla JavaScript** (ES6+)
- **HTML5 & CSS3**
- **Responsive Design**

### Desktop Application
- **Electron** v28.3.3
- **electron-builder** for packaging

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- MongoDB Atlas account (for database)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/zipX.git
   cd zipX
   ```

2. **Install root dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd Backend
   npm install
   cd ..
   ```

4. **Configure environment variables**
   
   Create a `.env` file in the `Backend` directory:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   ```

5. **Start the backend server**
   ```bash
   cd Backend
   npm start
   ```

6. **Access the application**
   - Web: Open `http://localhost:5000` in your browser
   - Desktop: Run `npm start` from the root directory

## 🖥️ Building Desktop Application

### Build Windows Installer

```bash
npm run build-win
```

The installer will be created in the `dist` folder:
- `zipX App Setup 1.0.0.exe` - Windows installer

### Distribution

1. Share the installer file with users
2. Users need:
   - Windows 7 or later (64-bit)
   - Internet connection (to connect to cloud backend)
   - ~500MB free disk space

### Installation on User's PC

1. Run `zipX App Setup 1.0.0.exe`
2. Follow installation wizard
3. Launch "zipX App" from desktop or Start Menu
4. Login with credentials

## 📱 Project Structure

```
zipX/
├── Backend/
│   ├── config/
│   │   └── db.js                 # Database configuration
│   ├── middleware/
│   │   └── authMiddleware.js     # JWT authentication
│   ├── models/                   # Mongoose models
│   │   ├── User.js
│   │   ├── Chemist.js
│   │   ├── Stockist.js
│   │   ├── StockistOrder.js
│   │   ├── ChemistLog.js
│   │   ├── Credit.js
│   │   ├── Message.js
│   │   ├── OrderRequest.js
│   │   └── MonthlySheet.js
│   ├── routes/                   # API routes
│   │   ├── authRoutes.js
│   │   ├── chemistRoutes.js
│   │   ├── stockistRoutes.js
│   │   ├── stockistOrderRoutes.js
│   │   ├── chemistLogRoutes.js
│   │   ├── creditRoutes.js
│   │   ├── messageRoutes.js
│   │   ├── orderRequestRoutes.js
│   │   └── monthlySheetRoutes.js
│   ├── utils/
│   │   ├── statusEngine.js       # Order status management
│   │   └── chemistLogTrigger.js  # Automated log creation
│   ├── tests/                    # Unit and property tests
│   ├── .env                      # Environment variables
│   ├── package.json
│   └── server.js                 # Entry point
├── Frontend/
│   ├── app.js                    # Main application logic
│   ├── index.html                # UI structure
│   └── logo.png                  # Application icon
├── dist/                         # Build output (generated)
├── electron-main.js              # Electron main process
├── package.json                  # Root package configuration
└── README.md
```

## 🔐 Authentication & Authorization

### User Roles

1. **Admin**
   - Full system access
   - User management
   - Approve/reject agent registrations
   - Monthly data reset
   - Order renumbering

2. **Agent**
   - Create and manage orders
   - View assigned chemists and stockists
   - Track credits
   - View messages

### Registration Flow

1. Agent registers through the app
2. Admin receives registration request
3. Admin approves/rejects the request
4. Approved agents can login and use the system

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new agent
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Orders
- `GET /api/stockist-orders` - Get all orders
- `POST /api/stockist-orders` - Create new order
- `PUT /api/stockist-orders/:id` - Update order
- `DELETE /api/stockist-orders/:id` - Delete order

### Credits
- `GET /api/credits` - Get all credits
- `POST /api/credits` - Create credit entry
- `PUT /api/credits/:id` - Update credit
- `DELETE /api/credits/:id` - Delete credit

### Chemist Logs
- `GET /api/chemist-logs` - Get all logs
- `POST /api/chemist-logs` - Create log
- `PUT /api/chemist-logs/:id` - Update log

### Admin
- `DELETE /api/admin/reset-month` - Reset monthly data
- `POST /api/admin/renumber-orders` - Renumber all orders

*For complete API documentation, see the route files in `Backend/routes/`*

## 🧪 Testing

The project includes unit tests and property-based tests:

```bash
cd Backend
npm test
```

Test files:
- `tests/chemistLog.unit.test.js` - Chemist log unit tests
- `tests/chemistLog.property.test.js` - Property-based tests
- `tests/stockistOrder.property.test.js` - Order property tests
- `tests/statusEngine.test.js` - Status engine tests
- `tests/generateOrderId.test.js` - Order ID generation tests
- `tests/paymentValidator.test.js` - Payment validation tests

## 🌐 Deployment

### Backend Deployment (Render.com)

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure:
   - **Build Command**: `cd Backend && npm install`
   - **Start Command**: `cd Backend && npm start`
4. Add environment variables (MONGO_URI, JWT_SECRET, PORT)
5. Deploy

### Frontend Deployment

The frontend is served by the Express backend as static files.

## 🔧 Configuration

### Electron Builder Configuration

The `package.json` includes electron-builder configuration:

```json
{
  "build": {
    "appId": "com.zipx.app",
    "productName": "zipX App",
    "win": {
      "target": "nsis"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true
    }
  }
}
```

### CORS Configuration

The backend allows requests from:
- `https://zipx-app.onrender.com`
- `http://localhost:5000`
- `http://localhost:3000`
- `capacitor://localhost`

## 📝 Development

### Running in Development Mode

**Backend:**
```bash
cd Backend
npm run dev  # Uses nodemon for auto-restart
```

**Desktop App:**
```bash
npm start  # Launches Electron in development mode
```

### Code Style

- Use ES6+ features
- Follow consistent naming conventions
- Add comments for complex logic
- Keep functions small and focused

## 🐛 Troubleshooting

### Desktop App Won't Start
- Check internet connection
- Verify backend is running at `https://zipx-app.onrender.com`
- Check Windows Firewall settings

### Database Connection Failed
- Verify MongoDB Atlas connection string
- Check IP whitelist in MongoDB Atlas (allow 0.0.0.0/0 for all IPs)
- Ensure database user has proper permissions

### Build Errors
- Delete `node_modules` and reinstall: `npm install`
- Clear electron-builder cache: `npm run build -- --clean`
- Check Node.js version compatibility

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 👤 Author

**Harshit Mishra**

## 🙏 Acknowledgments

- Express.js team for the excellent web framework
- MongoDB team for the robust database solution
- Electron team for enabling cross-platform desktop apps
- All contributors and users of this application

## 📞 Support

For support, please open an issue in the GitHub repository or contact the development team.

---

**Built with ❤️ for pharmaceutical distribution management**
