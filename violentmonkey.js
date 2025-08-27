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
                    toggleButton.innerHTML = `auto buy in ${timeLeft}s`;
                    toggleButton.style.background = CONFIG.BUTTON_ON_COLOR;
                } else {
                    toggleButton.innerHTML = 'Auto buying...';
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
                            }, index * 10);
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
                        }, 100);
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
})
