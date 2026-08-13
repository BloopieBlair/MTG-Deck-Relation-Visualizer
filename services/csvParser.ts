import type { RawDeckCard } from '../types';

// Handles simple CSV line with quotes and escaped quotes
export function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let currentField = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            // Check for escaped quote ("")
            if (inQuotes && i + 1 < line.length && line[i+1] === '"') {
                currentField += '"';
                i++; // Skip next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(currentField.trim());
            currentField = '';
        } else {
            currentField += char;
        }
    }
    result.push(currentField.trim()); // Add last field
    return result;
}


export function parseCsvContent(csvContent: string): RawDeckCard[] {
    const lines = csvContent.split(/\r?\n/).map(line => line.trim()).filter(line => line);
    if (lines.length < 1) return []; // Need at least a header if we expect one

    const headerLine = lines[0];
    const headers = parseCsvLine(headerLine).map(h => h.toLowerCase().replace(/^"|"$/g, '')); // Remove quotes from headers

    let nameIndex = -1;
    const nameSynonyms = ["name", "card name", "cardname", "card"];
    for (const syn of nameSynonyms) {
        const idx = headers.indexOf(syn);
        if (idx !== -1) {
            nameIndex = idx;
            break;
        }
    }

    if (nameIndex === -1) {
        console.warn("CSV parsing: 'name' column (or its synonyms like 'cardname') not found in header. Header found:", headers.join(', '));
        return []; // Indicate failure
    }

    let quantityIndex = -1;
    const quantitySynonyms = ["quantity", "count", "qty", "#", "amount"];
     for (const syn of quantitySynonyms) {
        const idx = headers.indexOf(syn);
        if (idx !== -1) {
            quantityIndex = idx;
            break;
        }
    }
    // If quantityIndex remains -1, default quantity will be 1 for each card.

    const cards: RawDeckCard[] = [];
    // Start from 1 if there's a header, or 0 if we treat all lines as data (less common for CSVs with headers)
    const dataStartIndex = lines.length > 0 && headers.length > 0 ? 1 : 0; 

    for (let i = dataStartIndex; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);

        const nameValue = values[nameIndex];
        const name = nameValue ? nameValue.replace(/^"|"$/g, '') : ''; // Remove surrounding quotes

        let quantity = 1; // Default quantity
        if (quantityIndex !== -1 && values.length > quantityIndex) {
            const quantityValue = values[quantityIndex];
            const parsedQuantity = parseInt(quantityValue ? quantityValue.replace(/^"|"$/g, '') : '1', 10);
            if (!isNaN(parsedQuantity) && parsedQuantity > 0) {
                quantity = parsedQuantity;
            }
        }
        
        if (name) {
            cards.push({ name, quantity });
        } else {
            // console.warn(`CSV parsing: Skipped row due to missing name or invalid format. Row content: ${lines[i]}`);
        }
    }
    return cards;
}