// ==UserScript==
// @name         Swarm Simulator Auto-Buyer
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Auto-buy meat, territory, and upgrades in Swarm Simulator
// @author       You
// @match        https://swarmsim.com/*
// @match        https://www.swarmsim.com/*
// @match        https://coffee.swarmsim.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let isEnabled = false;
    let intervalId = null;
    let toggleButton = null;

    // Create toggle button
    function createToggleButton() {
        toggleButton = document.createElement('button');
        toggleButton.innerHTML = 'Auto-Buyer: OFF';
        toggleButton.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 9999;
            padding: 10px;
            background: #ff4444;
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
            toggleButton.style.background = '#44ff44';
            startAutoBuyer();
        } else {
            toggleButton.innerHTML = 'Auto-Buyer: OFF';
            toggleButton.style.background = '#ff4444';
            stopAutoBuyer();
        }
    }

    // Start the auto-buyer interval
    function startAutoBuyer() {
        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(runAutoBuyer, 60000); // Run every minute
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
            }, 1000);
        }, 1000);
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
                    setTimeout(() => {}, 100);
                }
            }
        }, 500);
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
            }, 200);
        }
    }

    // Wait for Angular to be ready
    function waitForAngular(callback) {
        if (window.angular && document.querySelector('[ng-app]')) {
            callback();
        } else {
            setTimeout(() => waitForAngular(callback), 500);
        }
    }

    // Initialize when page loads
    function initialize() {
        // Wait for page to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialize);
            return;
        }
        
        // Wait for Angular to initialize
        waitForAngular(() => {
            setTimeout(() => {
                createToggleButton();
                console.log('Swarm Simulator Auto-Buyer initialized');
            }, 2000);
        });
    }

    initialize();
})();
