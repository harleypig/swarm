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
        // Timing settings (in milliseconds)
        AUTO_BUY_INTERVAL: 60000,        // How often to run auto-buyer (1 minute)
        INITIAL_DELAY: 15000,            // Wait time before initializing script (15 seconds)
        TAB_LOAD_DELAY: 1000,            // Wait time after clicking a tab (1 second)
        BETWEEN_TABS_DELAY: 1000,        // Delay between processing different tabs (1 second)
        BETWEEN_PURCHASES_DELAY: 500,    // Delay between individual unit purchases (0.5 seconds)
        UPGRADE_DROPDOWN_DELAY: 200,     // Wait time after opening upgrade dropdown (0.2 seconds)
        ANGULAR_CHECK_INTERVAL: 500,     // How often to check if Angular is ready (0.5 seconds)
        GAME_READY_CHECK_INTERVAL: 1000, // How often to check if game is ready (1 second)
        
        // UI settings
        BUTTON_TOP_POSITION: 10,         // Toggle button distance from top (pixels)
        BUTTON_RIGHT_POSITION: 10,       // Toggle button distance from right (pixels)
        BUTTON_Z_INDEX: 9999,            // Toggle button z-index
        
        // Colors
        BUTTON_OFF_COLOR: '#ff4444',     // Button color when disabled (red)
        BUTTON_ON_COLOR: '#44ff44',      // Button color when enabled (green)
    };

    let isEnabled = false;
    let intervalId = null;
    let toggleButton = null;

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
        `;

        toggleButton.addEventListener('click', toggleAutoBuyer);
        document.body.appendChild(toggleButton);
    }

    // Toggle auto-buyer on/off
    function toggleAutoBuyer() {
        isEnabled = !isEnabled;

        if (isEnabled) {
            toggleButton.innerHTML = 'Auto-Buyer: ON';
            toggleButton.style.background = CONFIG.BUTTON_ON_COLOR;
            startAutoBuyer();
        } else {
            toggleButton.innerHTML = 'Auto-Buyer: OFF';
            toggleButton.style.background = CONFIG.BUTTON_OFF_COLOR;
            stopAutoBuyer();
        }
    }

    // Start the auto-buyer interval
    function startAutoBuyer() {
        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(runAutoBuyer, CONFIG.AUTO_BUY_INTERVAL);
        console.log('Swarm Simulator Auto-Buyer started');
    }

    // Stop the auto-buyer interval
    function stopAutoBuyer() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        console.log('Swarm Simulator Auto-Buyer stopped');
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
            // Get all unit rows in the current tab
            const unitRows = document.querySelectorAll('tr[ng-repeat*="unit"]');

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
        // Look for tabs in the nav-tabs structure
        const tabLinks = document.querySelectorAll('.nav-tabs a, .tab a');

        for (let tab of tabLinks) {
            const tabText = tab.textContent.toLowerCase().trim();
            if (tabText.includes(tabName.toLowerCase())) {
                return tab;
            }

            // Also check for icon classes that might indicate the tab
            if (tab.querySelector(`.icon-${tabName}, .tab-icon-${tabName}`)) {
                return tab;
            }
        }

        return null;
    }

    // Try to buy max for a specific unit
    function tryBuyMaxForUnit(unitRow) {
        // Look for buy max button in this unit row
        // Based on buyunit-dropdown.html, look for dropdown with buy max options
        const buyMaxButton = unitRow.querySelector('a[ng-click*="buyMaxUnit"], a[ng-click*="buyMax"]');

        if (buyMaxButton) {
            // Check if the button is enabled (not disabled class)
            if (!buyMaxButton.classList.contains('disabled')) {
                const unitName = getUnitNameFromRow(unitRow);
                console.log(`Buying max ${unitName}`);
                buyMaxButton.click();
                return true;
            }
        }

        // Alternative: look for buy buttons in the advanced unit data area
        const buyButton = unitRow.querySelector('button[ng-click*="buyMaxUnit"]');
        if (buyButton && !buyButton.disabled && !buyButton.classList.contains('disabled')) {
            const unitName = getUnitNameFromRow(unitRow);
            console.log(`Buying max ${unitName}`);
            buyButton.click();
            return true;
        }

        return false;
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

        // Look for the "More..." dropdown first
        const moreDropdown = document.querySelector('.dropdown-toggle');
        if (moreDropdown && moreDropdown.textContent.includes('More')) {
            // Click to open dropdown
            moreDropdown.click();

            setTimeout(() => {
                // Look for "Buy all X upgrades" in the dropdown menu
                const buyAllUpgrades = document.querySelector('a[ng-click*="buyAllUpgrades"]');
                if (buyAllUpgrades && !buyAllUpgrades.parentElement.classList.contains('disabled')) {
                    console.log('Buying all available upgrades');
                    buyAllUpgrades.click();
                }

                // Also look for "Buy cheapest X upgrades"
                const buyCheapestUpgrades = document.querySelector('a[ng-click*="buyCheapestUpgrades"]');
                if (buyCheapestUpgrades && !buyCheapestUpgrades.parentElement.classList.contains('disabled')) {
                    console.log('Buying cheapest upgrades');
                    buyCheapestUpgrades.click();
                }

                // Close dropdown by clicking elsewhere
                document.body.click();
            }, CONFIG.UPGRADE_DROPDOWN_DELAY);
        }
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
