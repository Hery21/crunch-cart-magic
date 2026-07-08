@echo off
REM Web Build & Testing Guide for POS App (Windows)

echo ==========================================
echo Expo POS App - Web Build Testing (Windows)
echo ==========================================
echo.

echo Step 1: Building web version...
echo Command: npx expo export --platform web
echo.
echo This creates a static build in .\dist directory
echo.
pause

echo.
echo Step 2: Serving locally at http://localhost:8080
echo Command: npx http-server dist -c-1 -o
echo.
echo This will:
echo   - Start a local HTTP server
echo   - Open http://localhost:8080 in your browser
echo   - Clear browser cache (-c-1) to ensure fresh load
echo.
pause

echo.
echo Step 3: Verify in Browser DevTools
echo ==========================================
echo.
echo X Open DevTools (F12)
echo X Go to Console tab
echo X You should NOT see the 'message channel closed' error
echo.
echo X Go to Application tab ^> Local Storage
echo X Select http://localhost:8080
echo X You should see keys like:
echo     - ccr.settings
echo     - ccr.cart
echo     - ccr.transactions
echo.

echo Step 4: Manual Testing Checklist
echo ==========================================
echo.
echo [ ] App loads without errors
echo [ ] Console shows no 'message channel closed' error
echo [ ] Local Storage has keys (checked above)
echo [ ] Try adding items to cart
echo [ ] Refresh the page (F5)
echo [ ] Cart items persist (check Local Storage updated)
echo [ ] Try changing settings
echo [ ] Close browser and reopen — data still there
echo.

echo Step 5: Deploy to GitHub Pages
echo ==========================================
echo.
echo After verification, deploy:
echo.
echo   1. Build: npx expo export --platform web
echo   2. Commit: git add dist\
echo   3. Push: git push origin master
echo   4. Visit: https://hery21.github.io/crunch-cart-magic/
echo.

echo ==========================================
echo Need Help?
echo ==========================================
echo.
echo See: WEB_POLYFILL_README.md for detailed documentation
echo.

pause
