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
        BUTTON_OFF_FG_COLOR: 'white',    // Button text color when disabled
        BUTTON_OFF_BG_COLOR: '#ff4444',  // Button background color when disabled (red)
        BUTTON_ON_FG_COLOR: 'white',     // Button text color when enabled
        BUTTON_ON_BG_COLOR: '#33cc33',   // Button background color when enabled (darker green)
        BUTTON_BUYING_FG_COLOR: 'white', // Button text color while buying
        BUTTON_BUYING_BG_COLOR: '#ffaa00', // Button background color while buying (orange)
        
        // Event timing settings (in milliseconds)
        EVENT_SEQUENCE_DELAY: 10,        // Delay between individual mouse events in sequence
        DROPDOWN_CLOSE_DELAY: 100,       // Delay before closing dropdown after purchase
        BOOTSTRAP_DROPDOWN_DELAY: 100,   // Delay for Bootstrap dropdown simulation
        
        // Button styling
        BUTTON_PADDING: 10,              // Button padding (pixels)
        BUTTON_MIN_WIDTH: 200,           // Button minimum width (pixels)
        BUTTON_BORDER_RADIUS: 5,         // Button border radius (pixels)
        BUTTON_SHADOW_BLUR: 5,           // Button shadow blur radius (pixels)
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
            padding: ${CONFIG.BUTTON_PADDING}px;
            background: ${CONFIG.BUTTON_OFF_BG_COLOR};
            color: ${CONFIG.BUTTON_OFF_FG_COLOR};
            border: none;
            border-radius: ${CONFIG.BUTTON_BORDER_RADIUS}px;
            cursor: pointer;
            font-weight: bold;
            box-shadow: 0 2px ${CONFIG.BUTTON_SHADOW_BLUR}px rgba(0,0,0,0.3);
            min-width: ${CONFIG.BUTTON_MIN_WIDTH}px;
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
            toggleButton.style.background = CONFIG.BUTTON_OFF_BG_COLOR;
            toggleButton.style.color = CONFIG.BUTTON_OFF_FG_COLOR;
            stopAutoBuyer();
            stopCountdown();
        }
    }

    // Start the auto-buyer (run once immediately, then start countdown)
    function startAutoBuyer() {
        // Run immediately when enabled
        isCurrentlyBuying = true;
        runAutoBuyer().then(() => {
            isCurrentlyBuying = false;
            startCountdown(); // Start countdown for next run
        });
        console.log('Swarm Simulator Auto-Buyer started');
    }

    // Stop the auto-buyer
    function stopAutoBuyer() {
        stopCountdown();
        isCurrentlyBuying = false;
        console.log('Swarm Simulator Auto-Buyer stopped');
    }

    // Start countdown display and trigger next auto-buy when done
    function startCountdown() {
        if (!isEnabled) return; // Don't start countdown if disabled
        
        if (countdownId) clearInterval(countdownId);
        nextRunTime = Date.now() + CONFIG.AUTO_BUY_INTERVAL;

        countdownId = setInterval(() => {
            if (!isEnabled) {
                stopCountdown();
                return;
            }

            if (isCurrentlyBuying) {
                toggleButton.innerHTML = 'Auto buying...';
                toggleButton.style.background = CONFIG.BUTTON_BUYING_BG_COLOR;
                toggleButton.style.color = CONFIG.BUTTON_BUYING_FG_COLOR;
            } else {
                const timeLeft = Math.max(0, Math.ceil((nextRunTime - Date.now()) / 1000));
                if (timeLeft > 0) {
                    toggleButton.innerHTML = `Auto buy in ${timeLeft}s`;
                    toggleButton.style.background = CONFIG.BUTTON_ON_BG_COLOR;
                    toggleButton.style.color = CONFIG.BUTTON_ON_FG_COLOR;
                } else {
                    // Countdown finished - trigger next auto-buy cycle
                    stopCountdown();
                    isCurrentlyBuying = true;
                    toggleButton.innerHTML = 'Auto buying...';
                    toggleButton.style.background = CONFIG.BUTTON_BUYING_BG_COLOR;
                    toggleButton.style.color = CONFIG.BUTTON_BUYING_FG_COLOR;
                    
                    runAutoBuyer().then(() => {
                        isCurrentlyBuying = false;
                        startCountdown(); // Start countdown for next cycle
                    });
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

    // Main auto-buyer logic
    async function runAutoBuyer() {
        if (!isEnabled) return;

        console.log('Running auto-buyer cycle...');

        // Buy meat units and wait for completion
        await buyUnitsInTab('meat');

        // Small delay between tabs
        await new Promise(resolve => setTimeout(resolve, CONFIG.BETWEEN_TABS_DELAY));

        // Buy territory units and wait for completion
        await buyUnitsInTab('territory');

        // Small delay before upgrades
        await new Promise(resolve => setTimeout(resolve, CONFIG.BETWEEN_TABS_DELAY));

        // Buy upgrades
        buyUpgrades();
    }

    // Buy units in a specific tab (meat or territory)
    async function buyUnitsInTab(tabName) {
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
        return new Promise((resolve) => {
            setTimeout(async () => {
                // Get all unit rows in the current tab - use specific selector from main.html
                const unitRows = document.querySelectorAll('tr[ng-repeat="unit in cur.tab.sortUnits() | filter:filterVisible track by unit.name"]');

                // Process units from bottom to top (reverse order) sequentially
                const unitsArray = Array.from(unitRows);
                for (let i = unitsArray.length - 1; i >= 0; i--) {
                    const unitRow = unitsArray[i];

                    // Wait for each unit purchase to complete before moving to next
                    await tryBuyMaxForUnit(unitRow);
                    await new Promise(resolve => setTimeout(resolve, CONFIG.BETWEEN_PURCHASES_DELAY));
                }
                
                resolve();
            }, CONFIG.TAB_LOAD_DELAY);
        });
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
        return new Promise((resolve) => {
            // First, find the buyunitdropdown component
            const dropdown = unitRow.querySelector('buyunitdropdown');
            if (!dropdown) {
                resolve(false);
                return;
            }

            // Check if the dropdown button shows "Can't buy"
            const dropdownButton = dropdown.querySelector('.dropdown-toggle');
            if (!dropdownButton) {
                resolve(false);
                return;
            }

            // Check if it says "Can't buy" - if so, skip this unit
            const buttonText = dropdownButton.textContent.trim();
            if (buttonText.includes("Can't buy")) {
                resolve(false);
                return;
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

            // If no max button, try the 25% max button
            if (!buyMaxButton) {
                buyMaxButton = dropdown.querySelector('a[ng-click="buyMaxUnit({unit:unit, percent:0.25})"]');
            }

            // If no max buttons, try the regular buy button
            if (!buyMaxButton) {
                buyMaxButton = dropdown.querySelector('a[ng-click="buyUnit({unit:unit, num:fullnum()})"]');
            }

            // Check if the purchase amount is greater than current unit count
            if (buyMaxButton) {
                const unitName = getUnitNameFromRow(unitRow);

                // Get the current unit count from the table
                const currentCountCell = unitRow.querySelector('td:nth-child(3)');
                const currentCountText = currentCountCell ? currentCountCell.textContent.trim() : '0';

                // Get the buy amount from the button text
                const buyText = buyMaxButton.textContent.trim();
                const buyMatch = buyText.match(/Buy\s+([\d.e+]+)/i);

                if (buyMatch) {
                    const buyAmount = parseFloat(buyMatch[1]);
                    const currentCount = parseFloat(currentCountText.replace(/[,]/g, ''));

                    console.log(`${unitName}: Current=${currentCountText}, Buy=${buyMatch[1]}`);

                    if (buyAmount <= currentCount) {
                        console.log(`Skipping ${unitName}: buy amount (${buyAmount}) <= current count (${currentCount})`);
                        buyMaxButton = null; // Don't buy
                    } else {
                        console.log(`Will buy ${unitName}: buy amount (${buyAmount}) > current count (${currentCount})`);
                    }
                } else {
                    console.log(`Could not parse buy amount for ${unitName}: "${buyText}"`);
                    buyMaxButton = null; // Don't buy if we can't determine the amount
                }
            }

            if (buyMaxButton) {
                // Check if the parent li is disabled
                const parentLi = buyMaxButton.closest('li');
                if (parentLi && !parentLi.classList.contains('disabled')) {
                    const unitName = getUnitNameFromRow(unitRow);
                    console.log(`Clicking buy button for ${unitName}: ${buyMaxButton.getAttribute('ng-click')}`);

                    // Try multiple approaches to trigger the purchase
                    console.log(`Attempting purchase for ${unitName}`);

                    // Try multiple purchase methods in sequence
                    console.log(`Attempting purchase for ${unitName}`);

                    // Method 1: Try different event types and timing
                    function tryEventSequence() {
                        console.log(`Trying event sequence for ${unitName}`);
                        const events = [
                            { type: 'mouseenter', bubbles: true },
                            { type: 'mouseover', bubbles: true },
                            { type: 'mousedown', bubbles: true, button: 0 },
                            { type: 'focus', bubbles: false },
                            { type: 'mouseup', bubbles: true, button: 0 },
                            { type: 'click', bubbles: true, button: 0 }
                        ];

                        events.forEach((eventConfig, index) => {
                            setTimeout(() => {
                                const event = new MouseEvent(eventConfig.type, {
                                    view: window,
                                    bubbles: eventConfig.bubbles,
                                    cancelable: true,
                                    button: eventConfig.button || 0
                                });
                                buyMaxButton.dispatchEvent(event);
                            }, index * CONFIG.EVENT_SEQUENCE_DELAY);
                        });
                    }

                    // Method 2: Use jQuery's more powerful event system
                    function tryJQueryEvents() {
                        console.log(`Trying jQuery events for ${unitName}`);
                        if (window.jQuery) {
                            const $button = window.jQuery(buyMaxButton);

                            $button.focus()
                                   .trigger('mouseenter')
                                   .trigger('mouseover')
                                   .trigger('mousedown')
                                   .trigger('mouseup')
                                   .trigger('click')
                                   .trigger('change');

                            // Also try triggering with event data
                            $button.trigger('click', [{ synthetic: true }]);
                        }
                    }

                    // Method 3: Try to access Angular scope from parent elements
                    function tryParentScope() {
                        console.log(`Trying parent scope for ${unitName}`);
                        let workingScope = null;
                        let currentElement = buyMaxButton;

                        while (currentElement && !workingScope) {
                            try {
                                const scope = angular.element(currentElement).scope();
                                if (scope && (scope.buyMaxUnit || scope.buyUnit)) {
                                    workingScope = scope;
                                    console.log(`Found working scope on ${currentElement.tagName} for ${unitName}`);
                                    break;
                                }
                            } catch (e) {}
                            currentElement = currentElement.parentElement;
                        }

                        if (workingScope) {
                            try {
                                const ngClick = buyMaxButton.getAttribute('ng-click');
                                console.log(`Evaluating ng-click via parent scope: ${ngClick} for ${unitName}`);
                                workingScope.$eval(ngClick);
                                workingScope.$apply();
                                console.log(`Successfully executed ng-click via parent scope for ${unitName}`);
                                return true;
                            } catch (e) {
                                console.log(`Parent scope evaluation failed for ${unitName}:`, e.message);
                            }
                        } else {
                            console.log(`No working parent scope found for ${unitName}`);
                        }
                        return false;
                    }

                    // Method 4: Simulate exact Bootstrap dropdown behavior
                    function tryBootstrapDropdown() {
                        console.log(`Trying Bootstrap dropdown simulation for ${unitName}`);

                        setTimeout(() => {
                            if (dropdown.classList.contains('open')) {
                                const dropdownScope = angular.element(dropdown).scope();
                                if (dropdownScope) {
                                    try {
                                        if (buyMaxButton.getAttribute('ng-click').includes('buyMaxUnit')) {
                                            dropdownScope.buyMaxUnit({unit: dropdownScope.unit, percent: 1});
                                        } else {
                                            dropdownScope.buyUnit({unit: dropdownScope.unit, num: dropdownScope.fullnum()});
                                        }
                                        dropdownScope.$apply();
                                        console.log(`Bootstrap dropdown method succeeded for ${unitName}`);
                                        return true;
                                    } catch (e) {
                                        console.log(`Bootstrap dropdown method failed for ${unitName}:`, e.message);
                                    }
                                }
                            }
                            return false;
                        }, CONFIG.BOOTSTRAP_DROPDOWN_DELAY);
                    }

                    // Method 5: Use browser's native form submission
                    function tryFormSubmission() {
                        console.log(`Trying form submission for ${unitName}`);

                        const form = buyMaxButton.closest('form');
                        if (form) {
                            form.submit();
                        } else {
                            const href = buyMaxButton.getAttribute('href');
                            if (href && href !== 'javascript:' && href !== 'javascript:void(0)') {
                                console.log(`Following href for ${unitName}: ${href}`);
                                window.location.href = href;
                            } else {
                                // Create a temporary form and submit
                                const tempForm = document.createElement('form');
                                tempForm.style.display = 'none';
                                tempForm.action = 'javascript:void(0)';
                                document.body.appendChild(tempForm);
                                tempForm.submit();
                                document.body.removeChild(tempForm);
                            }
                        }
                    }

                    // Try methods in sequence (comment/uncomment as needed)
                    tryEventSequence();
                    tryJQueryEvents();
                    if (!tryParentScope()) {
                        tryBootstrapDropdown();
                        tryFormSubmission();
                    }

                    // Close the dropdown after clicking
                    setTimeout(() => {
                        document.body.click();
                    }, CONFIG.DROPDOWN_CLOSE_DELAY);
                } else {
                    console.log(`Buy button disabled for ${getUnitNameFromRow(unitRow)}`);
                }
            } else {
                console.log(`No buy buttons found for ${getUnitNameFromRow(unitRow)}`);
                // Close dropdown if button not found
                document.body.click();
            }
            
            resolve(true);
        }, CONFIG.DROPDOWN_OPEN_DELAY * 3); // Increase delay even more
        });
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
