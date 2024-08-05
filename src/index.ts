/* /////////////////////////////////////////////////
                    IMPORTS
///////////////////////////////////////////////// */

import * as fs from "fs";
import * as readline from "readline";

/* /////////////////////////////////////////////////
                     ENUMS
///////////////////////////////////////////////// */

enum Carrier {
    LP = "LP",
    MR = "MR",
}

enum PackageSize {
    S = "S",
    M = "M",
    L = "L",
}

enum DiscountType {
    SmallPrice,
    ThirdLargeSize,
}

/* /////////////////////////////////////////////////
                  INTERFACES
///////////////////////////////////////////////// */

// All current PACKAGE_PRICING variations
interface CarrierData {
    [carrier: string]: {
        // carrier => "LP", "MR"
        [packageSize: string]: number; // packageSize => "S", "M", "L"
    };
}

/* /////////////////////////////////////////////////
                    CONSTANTS
///////////////////////////////////////////////// */

// Carrier pricings
const PACKAGE_PRICING: CarrierData = {
    [Carrier.LP]: {
        [PackageSize.S]: 1.5,
        [PackageSize.M]: 4.9,
        [PackageSize.L]: 6.9,
    },
    [Carrier.MR]: { [PackageSize.S]: 2, [PackageSize.M]: 3, [PackageSize.L]: 4 },
};

// Smallest package price with applied discount
const SMALL_PACKAGE_DISCOUNTED_PRICE: number = Math.min(
    PACKAGE_PRICING[Carrier.LP][PackageSize.S],
    PACKAGE_PRICING[Carrier.MR][PackageSize.S]
);
// Current smallest package discount
const SMALL_PACKAGE_DISCOUNT: number = findSmallPackageDiscount(
    PACKAGE_PRICING[Carrier.LP][PackageSize.S],
    PACKAGE_PRICING[Carrier.MR][PackageSize.S]
);
const MAXIMUM_MONTHLY_DISCOUNT: number = 10;

/* /////////////////////////////////////////////////
                    VARIABLES
///////////////////////////////////////////////// */

// Large sized packages shipment count by month
let largeSizeFreeShipmentCount: { [month: string]: number } = {};
// Monthly discount accumulation by month
let accumulatedTotalMonthlyDiscounts: { [month: string]: number } = {};

/* /////////////////////////////////////////////////
                    FUNCTIONS
///////////////////////////////////////////////// */

export async function processTransactionsFromFile(inputFile: string) {
    // Read transactions from file
    const rl = readline.createInterface({
        input: fs.createReadStream(inputFile),
        output: process.stdout,
        terminal: false,
    });

    // For each line read and process data
    rl.on("line", (line: string) => {
        const [date, size, carrier] = line.split(" ");
        const month = date.slice(0, 7);

        // If size/data missmatch/corruption - ignore request
        if (
            !date ||
            !size ||
            !carrier ||
            !PACKAGE_PRICING[carrier] ||
            !PACKAGE_PRICING[carrier][size]
        ) {
            console.log(`${line} Ignored`);
            return;
        }

        // Initialize discount accumulation
        if (!accumulatedTotalMonthlyDiscounts[month]) {
            accumulatedTotalMonthlyDiscounts[month] = 0;
        }

        // Find original price by carrier and size
        let originalPrice: number = PACKAGE_PRICING[carrier][size];
        let currentDiscount: number = 0;

        if (size === PackageSize.S) {
            // Meet S size discount requirement
            [
                originalPrice,
                currentDiscount,
                accumulatedTotalMonthlyDiscounts[month],
            ] = applyDiscount(
                DiscountType.SmallPrice,
                originalPrice,
                accumulatedTotalMonthlyDiscounts[month]
            );

        } else if (size === PackageSize.L && carrier === Carrier.LP) {
            // Meet L size discount requirement
            [
                originalPrice,
                currentDiscount,
                accumulatedTotalMonthlyDiscounts[month],
            ] = applyDiscount(
                DiscountType.ThirdLargeSize,
                originalPrice,
                accumulatedTotalMonthlyDiscounts[month],
                month
            );
        }

        // Format data for display
        const discountDisplay =
            currentDiscount > 0 ? currentDiscount.toFixed(2) : "-";

        // Output results
        console.log(`${line} ${originalPrice.toFixed(2)} ${discountDisplay}`);
    });
}

export function findSmallPackageDiscount(
    postPrice: number,
    relayPrice: number
): number {
    return Math.abs(postPrice - relayPrice);
}

export function applyDiscount(
    type: DiscountType,
    currentPrice: number,
    totalDiscount: number,
    month?: string
): [number, number, number] {
    // Track current discount
    let currentDiscount = 0;

    // Check discount type
    switch (type) {
        case DiscountType.SmallPrice:
            // If current lowest discount price douesn't match the current price -
            // 1. Apply discount
            // 2. Update current price
            // 3. Track total discount
            if (currentPrice !== SMALL_PACKAGE_DISCOUNTED_PRICE) {
                const potentialDiscount = Math.min(
                    SMALL_PACKAGE_DISCOUNT,
                    MAXIMUM_MONTHLY_DISCOUNT - totalDiscount
                );
                currentDiscount = potentialDiscount > 0 ? potentialDiscount : 0;
                currentPrice -= currentDiscount;
                totalDiscount += currentDiscount;
            }
            break;
        case DiscountType.ThirdLargeSize:
            // Initialize large size shipment count for new month
            if (!largeSizeFreeShipmentCount[month!]) {
                largeSizeFreeShipmentCount[month!] = 0;
            }
            // Increment count for this month
            largeSizeFreeShipmentCount[month!]++;

            // If it is the third large size purchase - apply discount
            if (largeSizeFreeShipmentCount[month!] === 3) {
                currentDiscount = currentPrice;
                currentPrice = 0;
                totalDiscount += currentDiscount;
            }
            break;
        // Catch other discount type errors
        default:
            console.warn(`Unknown discount type: ${type}`);
            break;
    }

    return [currentPrice, currentDiscount, totalDiscount];
}

// Start processing transaction data
if (require.main === module) {
    processTransactionsFromFile("src/input.txt").catch((err) =>
        console.error(err)
    );
}
