// ==UserScript==
// @name         Swarm Simulator Auto-Buyer
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Auto-buy meat, territory, and upgrades in Swarm Simulator
// @author       harleypig
// @match        https://swarmsim.com/*
// @match        https://www.swarmsim.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Configuration variables - adjust these to tune the script behavior
    const CONFIG = {
        // General timing settings (in milliseconds)
        AUTO_BUY_INTERVAL: 30000,        // How often to run auto-buyer (30 seconds)
        INITIAL_DELAY: 15000,            // Wait time before initializing script (15 seconds)
        COUNTDOWN_UPDATE_INTERVAL: 1000, // How often to update countdown display (1 second)
        ANGULAR_CHECK_INTERVAL: 500,     // How often to check if Angular is ready (0.5 seconds)
        GAME_READY_CHECK_INTERVAL: 1000, // How often to check if game is ready (1 second)

        // Meat/Territory unit buying settings (in milliseconds)
        TAB_LOAD_DELAY: 1000,            // Wait time after clicking a tab (1 second)
        BETWEEN_TABS_DELAY: 1000,        // Delay between processing different tabs (1 second)
        BETWEEN_PURCHASES_DELAY: 1000,   // Delay between individual unit purchases (1 second)
        DROPDOWN_OPEN_DELAY: 200,        // Wait time after opening unit dropdown (0.2 seconds)

        // Upgrade buying settings (in milliseconds)
        UPGRADE_DROPDOWN_DELAY: 200,     // Wait time after opening upgrade dropdown (0.2 seconds)

        // Button appearance and positioning
        BUTTON_TOP_POSITION: 10,         // Toggle button distance from top (pixels)
        BUTTON_RIGHT_POSITION: 10,       // Toggle button distance from right (pixels)
        BUTTON_Z_INDEX: 9999,            // Toggle button z-index
        BUTTON_OFF_COLOR: '#ff4444',     // Button color when disabled (red)
        BUTTON_ON_COLOR: '#33cc33',      // Button color when enabled (darker green)
    };

    let isEnabled = false;
    let intervalId = null;
    let toggleButton = null;
    let countdownId = null;          // For countdown timer
    let nextRunTime = null;          // When next auto-buy will run
    let isCurrentlyBuying = false;   // Track if auto-buy is running

    // Create toggle button
    function createToggleButton() {
        toggleButton = document.createElement('button');
        toggleButton.innerHTML = 'Auto-Buyer: OFF';
        toggleButton.style.cssText = `
            position: fixed;
            top: ${CONFIG.BUTTON_TOP_POSITION}px;
            right: ${CONFIG.BUTTON_RIGHT_POSITION}px;
            z-index: ${CONFIG.BUTTON_Z_INDEX};
            padding: 10px;
            background: ${CONFIG.BUTTON_OFF_COLOR};
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            min-width: 200px;
            text-align: center;
        `;

        toggleButton.addEventListener('click', toggleAutoBuyer);
        document.body.appendChild(toggleButton);
    }

    // Toggle auto-buyer on/off
    function toggleAutoBuyer() {
        isEnabled = !isEnabled;

        if (isEnabled) {
            startAutoBuyer();
            startCountdown();
        } else {
            toggleButton.innerHTML = 'Auto-Buyer: OFF';
            toggleButton.style.background = CONFIG.BUTTON_OFF_COLOR;
            stopAutoBuyer();
            stopCountdown();
        }
    }

    // Start the auto-buyer interval
    function startAutoBuyer() {
        if (intervalId) clearInterval(intervalId);

        // Run immediately when enabled
        isCurrentlyBuying = true;
        runAutoBuyer();
        setTimeout(() => {
            isCurrentlyBuying = false;
            resetCountdown();
        }, CONFIG.BETWEEN_TABS_DELAY * 3); // Wait for all buying to complete

        // Then set up the interval for future runs
        intervalId = setInterval(() => {
            isCurrentlyBuying = true;
            runAutoBuyer();
            setTimeout(() => {
                isCurrentlyBuying = false;
                resetCountdown();
            }, CONFIG.BETWEEN_TABS_DELAY * 3); // Wait for all buying to complete
        }, CONFIG.AUTO_BUY_INTERVAL);
        console.log('Swarm Simulator Auto-Buyer started');
    }

    // Stop the auto-buyer interval
    function stopAutoBuyer() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        isCurrentlyBuying = false;
        stopCountdown();
        console.log('Swarm Simulator Auto-Buyer stopped');
    }

    // Start countdown display
    function startCountdown() {
        if (countdownId) clearInterval(countdownId);
        nextRunTime = Date.now() + CONFIG.AUTO_BUY_INTERVAL;

        countdownId = setInterval(() => {
            if (!isEnabled) {
                stopCountdown();
                return;
            }

            if (isCurrentlyBuying) {
                toggleButton.innerHTML = 'Auto Buying...';
                toggleButton.style.background = '#ffaa00'; // Orange while buying
            } else {
                const timeLeft = Math.max(0, Math.ceil((nextRunTime - Date.now()) / 1000));
                if (timeLeft > 0) {
                    toggleButton.innerHTML = `Next auto buy in ${timeLeft}s`;
                    toggleButton.style.background = CONFIG.BUTTON_ON_COLOR;
                } else {
                    toggleButton.innerHTML = 'Auto Buying...';
                    toggleButton.style.background = '#ffaa00';
                }
            }
        }, CONFIG.COUNTDOWN_UPDATE_INTERVAL);
    }

    // Stop countdown display
    function stopCountdown() {
        if (countdownId) {
            clearInterval(countdownId);
            countdownId = null;
        }
        nextRunTime = null;
    }

    // Reset countdown after auto-buy completes
    function resetCountdown() {
        if (isEnabled) {
            nextRunTime = Date.now() + CONFIG.AUTO_BUY_INTERVAL;
        }
    }

    // Main auto-buyer logic
    function runAutoBuyer() {
        if (!isEnabled) return;

        console.log('Running auto-buyer cycle...');

        // Buy meat units
        buyUnitsInTab('meat');

        // Small delay between tabs
        setTimeout(() => {
            // Buy territory units
            buyUnitsInTab('territory');

            // Small delay before upgrades
            setTimeout(() => {
                // Buy upgrades
                buyUpgrades();
            }, CONFIG.BETWEEN_TABS_DELAY);
        }, CONFIG.BETWEEN_TABS_DELAY);
    }

    // Buy units in a specific tab (meat or territory)
    function buyUnitsInTab(tabName) {
        console.log(`Processing ${tabName} tab...`);

        // Click the tab - look for tab with specific name
        const tab = findTab(tabName);
        if (!tab) {
            console.log(`${tabName} tab not found`);
            return;
        }

        // Click the tab
        tab.click();

        // Wait for tab content to load
        setTimeout(() => {
            // Get all unit rows in the current tab - use specific selector from main.html
            const unitRows = document.querySelectorAll('tr[ng-repeat="unit in cur.tab.sortUnits() | filter:filterVisible track by unit.name"]');

            // Process units from bottom to top (reverse order)
            const unitsArray = Array.from(unitRows);
            for (let i = unitsArray.length - 1; i >= 0; i--) {
                const unitRow = unitsArray[i];

                // Check if this unit has buy buttons and try to buy max
                if (tryBuyMaxForUnit(unitRow)) {
                    // Small delay between purchases
                    setTimeout(() => {}, CONFIG.BETWEEN_PURCHASES_DELAY);
                }
            }
        }, CONFIG.TAB_LOAD_DELAY);
    }

    // Find tab by name
    function findTab(tabName) {
        // Look for tabs by their href attribute
        const tabLink = document.querySelector(`a[href="#/tab/${tabName}"]`);
        if (tabLink) {
            return tabLink;
        }

        // If not found, the tab might not be available yet (like territory)
        console.log(`${tabName} tab not available yet`);
        return null;
    }

    // Try to buy max for a specific unit
    function tryBuyMaxForUnit(unitRow) {
        // First, find the buyunitdropdown component
        const dropdown = unitRow.querySelector('buyunitdropdown');
        if (!dropdown) return false;

        // Check if the dropdown button shows "Can't buy"
        const dropdownButton = dropdown.querySelector('.dropdown-toggle');
        if (!dropdownButton) return false;

        // Check if it says "Can't buy" - if so, skip this unit
        const buttonText = dropdownButton.textContent.trim();
        if (buttonText.includes("Can't buy")) {
            return false;
        }

        // Click to open dropdown
        dropdownButton.click();

        // Wait a moment, then find and click the buy max button
        setTimeout(() => {
            // Look for all available buy buttons in the dropdown
            const allBuyButtons = dropdown.querySelectorAll('a[ng-click*="buyMaxUnit"], a[ng-click*="buyUnit"]');
            console.log(`Found ${allBuyButtons.length} buy buttons for ${getUnitNameFromRow(unitRow)}`);

            // Try to find the max buy button (percent:1) first
            let buyMaxButton = dropdown.querySelector('a[ng-click="buyMaxUnit({unit:unit, percent:1})"]');

            // If no max button, try the regular buy button
            if (!buyMaxButton) {
                buyMaxButton = dropdown.querySelector('a[ng-click="buyUnit({unit:unit, num:fullnum()})"]');
                console.log(`Using regular buy button instead of max for ${getUnitNameFromRow(unitRow)}`);
            }

            if (buyMaxButton) {
                // Check if the parent li is disabled
                const parentLi = buyMaxButton.closest('li');
                if (parentLi && !parentLi.classList.contains('disabled')) {
                    const unitName = getUnitNameFromRow(unitRow);
                    console.log(`Clicking buy button for ${unitName}: ${buyMaxButton.getAttribute('ng-click')}`);

                    // Trigger the click event that Angular will handle
                    console.log(`Triggering click event for ${unitName}`);

                    // Create and dispatch a proper click event
                    const clickEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                    });

                    buyMaxButton.dispatchEvent(clickEvent);
                    console.log(`Click event dispatched for ${unitName}`);

                    // Close the dropdown after clicking
                    setTimeout(() => {
                        document.body.click();
                    }, 100);
                } else {
                    console.log(`Buy button disabled for ${getUnitNameFromRow(unitRow)}`);
                }
            } else {
                console.log(`No buy buttons found for ${getUnitNameFromRow(unitRow)}`);
                // Close dropdown if button not found
                document.body.click();
            }
        }, CONFIG.DROPDOWN_OPEN_DELAY * 3); // Increase delay even more

        return true;
    }

    // Get unit name from a table row
    function getUnitNameFromRow(unitRow) {
        // Look for the unit label
        const labelElement = unitRow.querySelector('.label-label, .titlecase, .unselectedlist-label');
        if (labelElement) {
            return labelElement.textContent.trim();
        }

        // Fallback: look for any text that might be the unit name
        const cells = unitRow.querySelectorAll('td');
        if (cells.length > 1) {
            return cells[1].textContent.trim();
        }

        return 'Unknown Unit';
    }

    // Buy upgrades using the "Buy all upgrades" button
    function buyUpgrades() {
        console.log('Looking for upgrade buttons...');

        // Find the More... dropdown specifically
        const moreDropdown = document.querySelector('.dropdown a.dropdown-toggle');
        if (!moreDropdown || !moreDropdown.textContent.includes('More')) {
            return;
        }

        moreDropdown.click();

        setTimeout(() => {
            // Use exact selectors from tabs.html
            const buyAllUpgrades = document.querySelector('a[ng-click="buyAllUpgrades()"]');
            if (buyAllUpgrades && !buyAllUpgrades.parentElement.classList.contains('disabled')) {
                console.log('Buying all available upgrades');
                buyAllUpgrades.click();
            }

            const buyCheapestUpgrades = document.querySelector('a[ng-click="buyCheapestUpgrades()"]');
            if (buyCheapestUpgrades && !buyCheapestUpgrades.parentElement.classList.contains('disabled')) {
                console.log('Buying cheapest upgrades');
                buyCheapestUpgrades.click();
            }

            // Close dropdown
            document.body.click();
        }, CONFIG.UPGRADE_DROPDOWN_DELAY);
    }

    // Wait for Angular to be ready
    function waitForAngular(callback) {
        if (window.angular && document.querySelector('[ng-app]')) {
            callback();
        } else {
            setTimeout(() => waitForAngular(callback), CONFIG.ANGULAR_CHECK_INTERVAL);
        }
    }

    // Check if game is fully ready (including storage system)
    function waitForGameReady(callback) {
        // Check if storage system is ready
        const storageReady = !document.querySelector('.loading') &&
                            document.querySelector('.nav-tabs') &&
                            // Add checks for game state being loaded
                            document.querySelector('tr[ng-repeat*="unit"]') &&
                            // Check if any units are visible (indicates data is loaded)
                            document.querySelectorAll('tr[ng-repeat*="unit"]').length > 0;

        if (window.angular && document.querySelector('[ng-app]') && storageReady) {
            callback();
        } else {
            setTimeout(() => waitForGameReady(callback), CONFIG.GAME_READY_CHECK_INTERVAL);
        }
    }

    // Initialize when page loads
    function initialize() {
        // Wait for page to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialize);
            return;
        }

        // Wait for Angular and game to be ready
        waitForAngular(() => {
            waitForGameReady(() => {
                setTimeout(() => {
                    createToggleButton();
                    console.log('Swarm Simulator Auto-Buyer initialized');
                }, CONFIG.INITIAL_DELAY);
            });
        });
    }

    initialize();
})();
