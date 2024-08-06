/* /////////////////////////////////////////////////
                    IMPORTS
///////////////////////////////////////////////// */
import * as fs from "fs";
import * as readline from "readline";
import {
    processTransactionsFromFile,
    processTransactions,
    findSmallPackageDiscount,
    applyDiscount,
    Carrier,
    PackageSize,
    DiscountType,
    PACKAGE_PRICING,
    SMALL_PACKAGE_DISCOUNTED_PRICE,
    MAXIMUM_MONTHLY_DISCOUNT,
    largeSizeFreeShipmentCount,
    accumulatedTotalMonthlyDiscounts,
} from "../src/index";

jest.mock("fs");
jest.mock("readline");

/* /////////////////////////////////////////////////
        PROCESS TRANSACTIONS FROM FILE TEST
///////////////////////////////////////////////// */

describe("processTransactionsFromFile", () => {
    const validLines = ["2023-08-06 S LP", "2023-08-06 L LP", "2023-08-06 M MR"];
    let mockReadStream: any;
    let mockInterface: any;

    beforeEach(() => {
        mockReadStream = { on: jest.fn() };
        mockInterface = { on: jest.fn(), close: jest.fn() };

        (fs.createReadStream as jest.Mock).mockReturnValue(mockReadStream);
        (readline.createInterface as jest.Mock).mockReturnValue(mockInterface);

        jest.spyOn(console, "log").mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("Should process transactions and return results", async () => {
        (mockInterface.on as jest.Mock).mockImplementation((event, callback) => {
            if (event === "line") validLines.forEach(callback);
            if (event === "close") callback();
            return mockInterface;
        });

        await processTransactionsFromFile("test_file.txt");

        expect(fs.createReadStream).toHaveBeenCalledWith("test_file.txt");
        expect(readline.createInterface).toHaveBeenCalledWith({
            input: mockReadStream,
            output: process.stdout,
            terminal: false,
        });

        expect(console.log).toHaveBeenCalledWith("2023-08-06 S LP 1.50 -");
        expect(console.log).toHaveBeenCalledWith("2023-08-06 L LP 6.90 -");
        expect(console.log).toHaveBeenCalledWith("2023-08-06 M MR 3.00 -");
    });

    it("Should log ignored lines", async () => {
        const invalidLines = [
            "2023-08-06 X LP",
            "2023-08-06 S XY",
            "2023-08-06 S",
            "S LP",
        ];
        (mockInterface.on as jest.Mock).mockImplementation((event, callback) => {
            if (event === "line") invalidLines.forEach(callback);
            if (event === "close") callback();
            return mockInterface;
        });

        await processTransactionsFromFile("test_file.txt");

        expect(fs.createReadStream).toHaveBeenCalledWith("test_file.txt");
        expect(readline.createInterface).toHaveBeenCalledWith({
            input: mockReadStream,
            output: process.stdout,
            terminal: false,
        });

        invalidLines.forEach((line) => {
            expect(console.log).toHaveBeenCalledWith(`${line} Ignored`);
        });
    });
});

/* /////////////////////////////////////////////////
        PROCESS TRANSACTIONS TEST
///////////////////////////////////////////////// */

describe("processTransactions", () => {
    const newLine = "2023-04-01 S LP";
    const month = "2023-04";
    const largeSize = PackageSize.L;
    const smallSize = PackageSize.S;
    const carrier = Carrier.LP;

    beforeEach(() => {
        accumulatedTotalMonthlyDiscounts[month] = 0;
        largeSizeFreeShipmentCount[month] = 0;
    });

    it("Should process a small package and apply discount", async () => {
        console.log = jest.fn();
        await processTransactions(newLine, month, smallSize, carrier);

        expect(console.log).toHaveBeenCalledWith("2023-04-01 S LP 1.50 -");
    });

    it("Should process the third large package and apply discount", async () => {
        const lineDayThree = "2023-04-05 L LP";
        const lineDayFour = "2023-04-05 L LP";
        const lineDayFive = "2023-04-05 L LP";

        await processTransactions(lineDayThree, month, largeSize, carrier);
        await processTransactions(lineDayFour, month, largeSize, carrier);
        console.log = jest.fn();
        await processTransactions(lineDayFive, month, largeSize, carrier);

        expect(console.log).toHaveBeenCalledWith("2023-04-05 L LP 0.00 6.90");
    });
});

/* /////////////////////////////////////////////////
        FIND SMALL PACHAGE DISCOUNT TEST
///////////////////////////////////////////////// */

describe("findSmallPackageDiscount", () => {
    it("Should determine small package discount", () => {
        const discount = findSmallPackageDiscount(
            PACKAGE_PRICING[Carrier.LP][PackageSize.S],
            PACKAGE_PRICING[Carrier.MR][PackageSize.S]
        );
        const calculatedDiscount =
            PACKAGE_PRICING[Carrier.MR][PackageSize.S] -
            PACKAGE_PRICING[Carrier.LP][PackageSize.S];
        expect(discount).toBe(calculatedDiscount);
    });

    it("Should determine other type package discounts", () => {
        const mediumPackageSizeDiscount = findSmallPackageDiscount(
            PACKAGE_PRICING[Carrier.LP][PackageSize.M],
            PACKAGE_PRICING[Carrier.MR][PackageSize.M]
        );
        const mediumPackageCalculatedDiscount =
            PACKAGE_PRICING[Carrier.LP][PackageSize.M] -
            PACKAGE_PRICING[Carrier.MR][PackageSize.M];

        expect(mediumPackageSizeDiscount).toBe(mediumPackageCalculatedDiscount);
    });
});

/* /////////////////////////////////////////////////
            APPLY DISCOUNT TEST
///////////////////////////////////////////////// */

describe("applyDiscount", () => {
    const month = "2023-04";
    let totalDiscount = 0;

    beforeEach(() => {
        accumulatedTotalMonthlyDiscounts[month] = 0;
        largeSizeFreeShipmentCount[month] = 0;
    });

    it("Should apply small package discount", () => {
        const [newPrice, discount, totalDiscount] = applyDiscount(
            DiscountType.SmallPrice,
            PACKAGE_PRICING[Carrier.MR][PackageSize.S],
            0
        );
        const smallPackageDiscount =
            PACKAGE_PRICING[Carrier.MR][PackageSize.S] -
            PACKAGE_PRICING[Carrier.LP][PackageSize.S];

        expect(newPrice).toBe(SMALL_PACKAGE_DISCOUNTED_PRICE);
        expect(discount).toBe(smallPackageDiscount);
        expect(totalDiscount).toBe(smallPackageDiscount);
    });

    it("Should apply large package discount", () => {
        applyDiscount(
            DiscountType.ThirdLargeSize,
            PACKAGE_PRICING[Carrier.LP][PackageSize.L],
            totalDiscount,
            month
        );
        applyDiscount(
            DiscountType.ThirdLargeSize,
            PACKAGE_PRICING[Carrier.LP][PackageSize.L],
            totalDiscount,
            month
        );
        const [newPrice, discount, updatedTotalDiscount] = applyDiscount(
            DiscountType.ThirdLargeSize,
            PACKAGE_PRICING[Carrier.LP][PackageSize.L],
            totalDiscount,
            month
        );

        expect(newPrice).toBe(0);
        expect(discount).toBe(PACKAGE_PRICING[Carrier.LP][PackageSize.L]);
        expect(updatedTotalDiscount).toBe(
            PACKAGE_PRICING[Carrier.LP][PackageSize.L]
        );
    });

    it("Should not apply discount when maximum monthly discount reached", () => {
        const [newPrice, discount, totalDiscount] = applyDiscount(
            DiscountType.SmallPrice,
            PACKAGE_PRICING[Carrier.MR][PackageSize.S],
            MAXIMUM_MONTHLY_DISCOUNT
        );
        expect(newPrice).toBe(PACKAGE_PRICING[Carrier.MR][PackageSize.S]);
        expect(discount).toBe(0);
        expect(totalDiscount).toBe(MAXIMUM_MONTHLY_DISCOUNT);
    });

    it("Should throw error when faux dicsount type passed", () => {
        console.warn = jest.fn();
        const fauxDiscountType = 2 as DiscountType;

        applyDiscount(
            fauxDiscountType,
            PACKAGE_PRICING[Carrier.MR][PackageSize.S],
            0
        );

        expect(console.warn).toHaveBeenCalledWith(
            `Unknown discount type: ${fauxDiscountType}`
        );
    });
});
