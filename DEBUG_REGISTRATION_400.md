# 🔧 Debugging Registration OTP 400 Error

## Problem
The `/api/auth/register/request-otp` endpoint is returning **400 Bad Request**

## Root Causes & Solutions

### 1. **Email Validation Failed**
The backend expects a valid email format from `EmailStr` validator.

**How to check:**
1. Open browser DevTools (`F12`)
2. Go to Console tab
3. Try registering and look for logs like:
   ```
   📤 Sending OTP request with: { email: "your@email.com" }
   ```

**Solution:**
- Ensure email is in valid format: `user@example.com`
- Check for extra spaces: ` user@example.com ` (invalid)
- Avoid special characters in email name

### 2. **Empty Email Field**
The email field might be empty when sent.

**Debug:**
```javascript
// Open DevTools Console and run:
document.getElementById("email").value
// Should return your email, not empty string ""
```

**Solution:**
- Enter email in the email field
- Make sure it's not hidden or invisible

### 3. **Form Validation Skipped**
The frontend validation might be passing invalid inputs.

**Debug - Check Form State:**
```javascript
// Open DevTools Console and run:
const frm = document.getElementById("registerForm");
const emailField = frm.querySelector("#email");
console.log("Email field value:", emailField.value);
console.log("Email field visible:", emailField.offsetParent !== null);
console.log("Email field required:", emailField.required);
```

**Solution:**
- All visible required fields must have values
- Email must pass regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`

### 4. **Request Body Malformed**
The JSON being sent might be invalid.

**Debug:**
```javascript
// Don't modify the code  - just check the Network tab in DevTools
// 1. Open DevTools (F12)
// 2. Go to Network tab
// 3. Try registering
// 4. Look for POST request to `/api/auth/register/request-otp`
// 5. Click on it
// 6. View "Request" payload under "Payload" tab
// Should show:
// {
//   "email": "your@email.com"
// }
```

---

## How to Debug Step-by-Step

### Step 1: Enable Console Logging
Open DevTools (`F12`) → Console tab

### Step 2: Fill Registration Form
- **Customer Page**: `/www/pages/register.html`
- **Rider Page**: `/www/pages/rider-register.html`

Fill in:
- Full Name: `John Doe`
- Email: `john@example.com` (valid email!)
- Phone: `+639171234567` or `09171234567`
- Address: `123 Main St`
- Password: `SecurePass123!` (uppercase, lowercase, number, special char)
- Confirm Password: Same as above
- ✓ Agree to Terms

### Step 3: Watch Console Logs
You should see logs like:
```
📝 Form Data Collected: {
  full_name: "✓",
  email: "john@example.com",
  phone_number: "✓",
  password: "✓",
  user_type: "customer",
  address: "✓"
}
📤 Sending OTP request with: {
  email: "john@example.com"
}
```

### Step 4: Check Network Response
- Open DevTools → Network tab
- Submit form
- Look for `request-otp` POST request
- Click it and check Response tab
- Should show detailed error like:
  ```json
  {
    "success": false,
    "message": "Validation error",
    "detail": [
      {
        "field": "email",
        "message": "invalid email format",
        "type": "value_error.email"
      }
    ]
  }
  ```

---

## Common Email Issues

### ❌ Invalid Emails
```
test              (no @)
test@             (no domain)
test@domain       (no extension)
test@.com         (no domain name)
test @email.com   (space in email)
```

### ✅ Valid Emails
```
user@example.com
john.doe@company.co.uk
test123@domain.org
user+tag@service.com
```

---

## Backend Error Response Format

After the fix, you'll see better error messages:

### Success Response (200)
```json
{
  "success": true,
  "message": "OTP sent to your email. Valid for 10 minutes.",
  "data": {
    "email": "user@example.com"
  }
}
```

### Validation Error (422)
```json
{
  "success": false,
  "message": "Validation error",
  "detail": [
    {
      "field": "email",
      "message": "Invalid email format",
      "type": "value_error.email"
    }
  ],
  "errors": [...]  // Raw error details for debugging
}
```

### Business Logic Error (400)
```json
{
  "success": false,
  "message": "Email already registered"
}
```

---

## Testing via curl

Test the endpoint directly without frontend:

```powershell
# Test with valid email
curl -X POST "https://pasugo.onrender.com/api/auth/register/request-otp" `
  -H "Content-Type: application/json" `
  -d '{"email": "test@example.com"}'

# Test with invalid email (should fail with 422)
curl -X POST "https://pasugo.onrender.com/api/auth/register/request-otp" `
  -H "Content-Type: application/json" `
  -d '{"email": "not-an-email"}'

# Test with empty email (should fail with 422)
curl -X POST "https://pasugo.onrender.com/api/auth/register/request-otp" `
  -H "Content-Type: application/json" `
  -d '{"email": ""}'
```

---

## Frontend Fixes Applied

✅ **Added detailed logging to requestRegistrationOTP()**
- Now shows exactly what email is being sent
- Logs backend error response
- Helps identify validation issues

✅ **Added logging to getFormData()**
- Shows which fields are filled vs empty
- Helps identify missing required data

✅ **Email trimmed and lowercased**
- Removes accidental spaces
- Normalizes email format

---

## Backend Fixes Applied

✅ **Added RequestValidationError handler**
- Returns detailed error messages
- Shows which fields failed validation
- Returns status code 422 instead of 400

✅ **Better error context**
- Field names
- Error type
- Raw Pydantic errors for debugging

---

## Quick Checklist

Before registering, verify:

- [ ] Email field has a valid email (user@example.com format)
- [ ] No extra spaces in email
- [ ] Full Name is not empty
- [ ] Phone number is valid (+63 or 09 format, or with spaces)
- [ ] Password is 8+ characters with uppercase, lowercase, number, special char
- [ ] Passwords match
- [ ] Terms & Conditions checkbox is checked
- [ ] For rider: All rider-specific fields are filled
- [ ] No console errors (F12 → Console tab)

---

## Still Not Working?

If you still get 400 errors after these fixes:

1. **Check browser console** for detailed error messages
2. **Check Network tab** for actual request/response
3. **Check backend logs** (where you run uvicorn)
4. **Try curl test** from backend setup guide
5. **Clear browser cache**: `Ctrl+Shift+Delete` → Clear cache
6. **Restart backend server**: Stop uvicorn, then restart

---

## Related Files Changed

**Frontend:**
- `www/js/auth.js` - Enhanced logging and error handling

**Backend:**
- `app.py` - Added RequestValidationError handler
- `routes/auth.py` - Better error messages (existing)

---

## Next: Test the Full Flow

Once OTP request works:

1. ✅ Request OTP → Check for success message
2. ⏳ Look for OTP code in console logs (dev mode)
3. ⏳ Enter OTP code in the verification screen
4. ⏳ Complete registration
5. ⏳ Verify user created in database

Happy debugging! 🚀
