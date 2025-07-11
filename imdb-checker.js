const axios = require('axios');
const cheerio = require('cheerio');
const readline = require('readline');

class IMDBParentsGuideChecker {
    constructor() {
        this.baseURL = 'https://www.imdb.com';
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
        ];
        this.requestCount = 0;
        this.minDelay = 500; // 2 seconds minimum delay
        this.maxDelay = 1000; // 5 seconds maximum delay
        this.maxRequestsPerMinute = 30;
        this.requestTimestamps = [];
    }

    getRandomUserAgent() {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    getRandomDelay() {
        return Math.floor(Math.random() * (this.maxDelay - this.minDelay + 1)) + this.minDelay;
    }

    async rateLimitedDelay() {
        // Clean old timestamps (older than 1 minute)
        const oneMinuteAgo = Date.now() - 60000;
        this.requestTimestamps = this.requestTimestamps.filter(timestamp => timestamp > oneMinuteAgo);
        
        // Check if we need to wait
        if (this.requestTimestamps.length >= this.maxRequestsPerMinute) {
            const oldestRequest = Math.min(...this.requestTimestamps);
            const waitTime = 60000 - (Date.now() - oldestRequest);
            if (waitTime > 0) {
                console.log(`⏳ Rate limiting: waiting ${Math.ceil(waitTime/1000)} seconds...`);
                await this.sleep(waitTime);
            }
        }
        
        // Add random delay between requests
        const delay = this.getRandomDelay();
        console.log(`⏳ Waiting ${delay/1000} seconds before next request...`);
        await this.sleep(delay);
        
        // Record this request
        this.requestTimestamps.push(Date.now());
        this.requestCount++;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getHeaders() {
        return {
            'User-Agent': this.getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0'
        };
    }

    async searchMovie(query) {
        try {
            await this.rateLimitedDelay();
            
            const searchURL = `${this.baseURL}/find?q=${encodeURIComponent(query)}&s=tt&ttype=ft,tv`;
            console.log(`🔍 Searching for: ${query}`);
            
            const response = await axios.get(searchURL, { 
                headers: this.getHeaders(),
                timeout: 10000
            });
            const $ = cheerio.load(response.data);
            
            // Look for the first movie/TV show result
            const firstResult = $('.ipc-metadata-list-summary-item').first();
            
            if (firstResult.length === 0) {
                return null;
            }
            
            const titleLink = firstResult.find('a').attr('href');
            const title = firstResult.find('.ipc-metadata-list-summary-item__t').text().trim();
            const year = firstResult.find('.ipc-metadata-list-summary-item__li').first().text().trim();
            
            if (!titleLink) {
                return null;
            }
            
            // Extract IMDB ID from the link
            const imdbID = titleLink.match(/\/title\/(tt\d+)\//)?.[1];
            
            if (!imdbID) {
                return null;
            }
            
            return {
                title,
                year,
                imdbID,
                url: `${this.baseURL}${titleLink}`
            };
            
        } catch (error) {
            console.error('Error searching movie:', error.message);
            return null;
        }
    }

    async checkParentsGuide(imdbID) {
        try {
            await this.rateLimitedDelay();
            
            const parentsGuideURL = `${this.baseURL}/title/${imdbID}/parentalguide/`;
            console.log(`📋 Checking parents guide: ${parentsGuideURL}`);
            
            const response = await axios.get(parentsGuideURL, { 
                headers: this.getHeaders(),
                timeout: 10000
            });
            const $ = cheerio.load(response.data);
            
            // Look for Sex & Nudity section
            let sexNudityRating = null;
            let sexNudityContent = '';
            let mildReasons = [];
            
            // Try different selectors for Sex & Nudity section
            const sections = $('.ipc-page-section');
            
            for (let i = 0; i < sections.length; i++) {
                const section = $(sections[i]);
                const sectionTitle = section.find('h3, h4').text().toLowerCase();
                
                if (sectionTitle.includes('sex') && sectionTitle.includes('nudity')) {
                    // Look for severity rating
                    const severityElement = section.find('.ipc-signpost').first();
                    if (severityElement.length > 0) {
                        sexNudityRating = severityElement.text().trim();
                    } else {
                        // Alternative: look for text content that might indicate "None"
                        const content = section.text().toLowerCase();
                        if (content.includes('none') || content.includes('no content')) {
                            sexNudityRating = 'None';
                        }
                    }
                    
                    // Extract content details for "Mild" analysis
                    const contentItems = section.find('.ipc-html-content-inner-div, .advisory-content, li');
                    contentItems.each((index, element) => {
                        const text = $(element).text().trim();
                        if (text && text.length > 10) { // Filter out short/empty text
                            sexNudityContent += text + ' ';
                        }
                    });
                    
                    // If no content items found, get all text from section
                    if (!sexNudityContent.trim()) {
                        sexNudityContent = section.text().replace(/\s+/g, ' ').trim();
                    }
                    
                    break;
                }
            }
            
            // Fallback: try older IMDB layout
            if (!sexNudityRating) {
                const oldFormatSection = $('#advisory-nudity');
                if (oldFormatSection.length > 0) {
                    const severity = oldFormatSection.find('.advisory-severity-vote').text().trim();
                    if (severity) {
                        sexNudityRating = severity;
                    }
                    
                    // Get content from old format
                    const oldContent = oldFormatSection.find('.advisory-content').text().trim();
                    if (oldContent) {
                        sexNudityContent = oldContent;
                    }
                }
            }
            
            // Analyze content for "Mild" reasons if rating is "Mild"
            if (sexNudityRating && sexNudityRating.toLowerCase().includes('mild')) {
                mildReasons = this.analyzeMildContent(sexNudityContent);
            }
            
            return {
                parentsGuideURL,
                sexNudityRating: sexNudityRating || 'Unknown',
                sexNudityContent: sexNudityContent,
                mildReasons: mildReasons
            };
            
        } catch (error) {
            console.error('Error checking parents guide:', error.message);
            return null;
        }
    }

    analyzeMildContent(content) {
        const reasons = [];
        const lowerContent = content.toLowerCase();
        
        // Common mild content indicators
        const mildIndicators = [
            { keyword: ['kissing', 'kiss', 'kisses'], reason: 'Contains kissing scenes' },
            { keyword: ['brief nudity', 'briefly nude', 'brief partial nudity'], reason: 'Brief nudity shown' },
            { keyword: ['shirtless', 'bare chest', 'topless male'], reason: 'Male characters shown shirtless' },
            { keyword: ['cleavage', 'low cut'], reason: 'Some cleavage visible' },
            { keyword: ['suggestive', 'innuendo', 'sexual innuendo'], reason: 'Sexual innuendo or suggestive content' },
            { keyword: ['romantic', 'romance', 'love scene'], reason: 'Romantic scenes' },
            { keyword: ['flirting', 'flirt'], reason: 'Flirtatious behavior' },
            { keyword: ['revealing clothing', 'skimpy', 'tight clothing'], reason: 'Revealing or tight clothing' },
            { keyword: ['buttocks', 'rear end', 'bottom'], reason: 'Brief glimpse of buttocks' },
            { keyword: ['underwear', 'bra', 'panties'], reason: 'Characters shown in underwear' },
            { keyword: ['statue', 'painting', 'artwork'], reason: 'Artistic nudity (statues/paintings)' },
            { keyword: ['medical', 'hospital', 'doctor'], reason: 'Medical/clinical context' },
            { keyword: ['bathing', 'shower', 'bath'], reason: 'Bathing scenes (non-explicit)' },
            { keyword: ['dancing', 'seductive dance'], reason: 'Suggestive dancing' },
            { keyword: ['magazine', 'poster', 'picture'], reason: 'Suggestive images/posters in background' }
        ];
        
        for (const indicator of mildIndicators) {
            for (const keyword of indicator.keyword) {
                if (lowerContent.includes(keyword)) {
                    if (!reasons.includes(indicator.reason)) {
                        reasons.push(indicator.reason);
                    }
                    break;
                }
            }
        }
        
        // If no specific reasons found but content exists, provide generic reason
        if (reasons.length === 0 && content.trim()) {
            reasons.push('Content deemed mild by IMDB reviewers');
        }
        
        return reasons;
    }

    async checkMultipleMovies(movieList) {
        console.log(`\n🎬 Checking ${movieList.length} movies/TV shows...`);
        console.log('=' * 60);
        
        const results = [];
        
        for (let i = 0; i < movieList.length; i++) {
            const movieName = movieList[i].trim();
            if (!movieName) continue;
            
            console.log(`\n[${i + 1}/${movieList.length}] Processing: ${movieName}`);
            console.log('-'.repeat(50));
            
            try {
                const result = await this.checkMovie(movieName, false); // Don't show individual results
                if (result) {
                    results.push(result);
                } else {
                    results.push({
                        title: movieName,
                        error: 'Not found or error occurred'
                    });
                }
            } catch (error) {
                console.error(`❌ Error processing ${movieName}:`, error.message);
                results.push({
                    title: movieName,
                    error: error.message
                });
            }
            
            // Progress indicator
            const progress = Math.round((i + 1) / movieList.length * 100);
            console.log(`📊 Progress: ${progress}% (${i + 1}/${movieList.length})`);
        }
        
        return results;
    }

    displayBatchResults(results) {
        console.log('\n' + '='.repeat(80));
        console.log('📊 BATCH RESULTS SUMMARY');
        console.log('='.repeat(80));
        
        const noneRated = results.filter(r => r.category === 'None');
        const mildRated = results.filter(r => r.category === 'Mild');
        const otherRated = results.filter(r => r.category === 'Other' && !r.error);
        const errors = results.filter(r => r.error);
        
        // None Category
        console.log(`\n✅ Movies/Shows with "None" Sex & Nudity rating: ${noneRated.length}`);
        if (noneRated.length > 0) {
            noneRated.forEach((movie, index) => {
                console.log(`  ${index + 1}. ${movie.title} (${movie.year})`);
                console.log(`     📋 Parents Guide: ${movie.parentsGuideURL}`);
            });
        }
        
        // Mild Category
        console.log(`\n⚠️  Movies/Shows with "Mild" Sex & Nudity rating: ${mildRated.length}`);
        if (mildRated.length > 0) {
            mildRated.forEach((movie, index) => {
                console.log(`  ${index + 1}. ${movie.title} (${movie.year})`);
                console.log(`     📋 Parents Guide: ${movie.parentsGuideURL}`);
                if (movie.mildReasons && movie.mildReasons.length > 0) {
                    console.log(`     📝 Mild Content Reasons:`);
                    movie.mildReasons.forEach((reason, reasonIndex) => {
                        console.log(`        • ${reason}`);
                    });
                }
                console.log(''); // Extra spacing between mild entries
            });
        }
        
        // Other Category
        console.log(`\n❌ Movies/Shows with other ratings: ${otherRated.length}`);
        if (otherRated.length > 0) {
            otherRated.forEach((movie, index) => {
                console.log(`  ${index + 1}. ${movie.title} (${movie.year}) - Rating: ${movie.sexNudityRating}`);
                console.log(`     📋 Parents Guide: ${movie.parentsGuideURL}`);
            });
        }
        
        // Errors
        console.log(`\n⚠️  Errors/Not found: ${errors.length}`);
        if (errors.length > 0) {
            errors.forEach((movie, index) => {
                console.log(`  ${index + 1}. ${movie.title} - ${movie.error}`);
            });
        }
        
        // Summary Statistics
        console.log(`\n📊 CATEGORY BREAKDOWN:`);
        console.log(`   ✅ None: ${noneRated.length} (${Math.round(noneRated.length / results.length * 100)}%)`);
        console.log(`   ⚠️  Mild: ${mildRated.length} (${Math.round(mildRated.length / results.length * 100)}%)`);
        console.log(`   ❌ Other: ${otherRated.length} (${Math.round(otherRated.length / results.length * 100)}%)`);
        console.log(`   ⚠️  Errors: ${errors.length} (${Math.round(errors.length / results.length * 100)}%)`);
        
        console.log(`\n📈 Total processed: ${results.length}`);
        console.log(`🎯 Success rate: ${Math.round((results.length - errors.length) / results.length * 100)}%`);
        console.log(`🔍 Family-friendly (None + Mild): ${noneRated.length + mildRated.length} (${Math.round((noneRated.length + mildRated.length) / results.length * 100)}%)`);
        console.log('='.repeat(80));
    }
    async checkMovie(movieName, showOutput = true) {
        if (showOutput) {
            console.log(`\n=== Checking: ${movieName} ===`);
        }
        
        // Search for the movie
        const searchResult = await this.searchMovie(movieName);
        
        if (!searchResult) {
            if (showOutput) {
                console.log('❌ Movie not found on IMDB');
            }
            return null;
        }
        
        if (showOutput) {
            console.log(`✅ Found: ${searchResult.title} (${searchResult.year})`);
            console.log(`🔗 IMDB URL: ${searchResult.url}`);
        }
        
        // Check parents guide
        const parentsGuide = await this.checkParentsGuide(searchResult.imdbID);
        
        if (!parentsGuide) {
            if (showOutput) {
                console.log('❌ Could not access parents guide');
            }
            return null;
        }
        
        if (showOutput) {
            console.log(`📋 Parents Guide URL: ${parentsGuide.parentsGuideURL}`);
            console.log(`🔞 Sex & Nudity Rating: ${parentsGuide.sexNudityRating}`);
            
            // Show mild reasons if applicable
            if (parentsGuide.mildReasons && parentsGuide.mildReasons.length > 0) {
                console.log(`📝 Mild Content Reasons:`);
                parentsGuide.mildReasons.forEach((reason, index) => {
                    console.log(`   ${index + 1}. ${reason}`);
                });
            }
        }
        
        // Categorize rating
        const rating = parentsGuide.sexNudityRating.toLowerCase();
        const isNone = rating.includes('none');
        const isMild = rating.includes('mild');
        let category = 'Other';
        
        if (isNone) {
            category = 'None';
        } else if (isMild) {
            category = 'Mild';
        }
        
        if (showOutput) {
            if (isNone) {
                console.log('✅ RESULT: Sex & Nudity is rated as "None"');
            } else if (isMild) {
                console.log('⚠️  RESULT: Sex & Nudity is rated as "Mild"');
            } else {
                console.log('❌ RESULT: Sex & Nudity has other rating');
            }
        }
        
        return {
            title: searchResult.title,
            year: searchResult.year,
            imdbURL: searchResult.url,
            parentsGuideURL: parentsGuide.parentsGuideURL,
            sexNudityRating: parentsGuide.sexNudityRating,
            sexNudityContent: parentsGuide.sexNudityContent,
            mildReasons: parentsGuide.mildReasons || [],
            category: category,
            isNone: isNone,
            isMild: isMild
        };
    }

    async startInteractiveMode() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log('🎬 IMDB Parents Guide Checker');
        console.log('Enter movie/TV show names to check their Sex & Nudity rating');
        console.log('For multiple movies, separate names with pipe (|)');
        console.log('Example: "The Matrix | Finding Nemo | Toy Story"');
        console.log('Type "exit" to quit\n');

        const askForInput = () => {
            rl.question('Enter movie/TV show name(s): ', async (input) => {
                if (input.toLowerCase() === 'exit') {
                    rl.close();
                    return;
                }
                
                if (input.trim()) {
                    // Check if input contains pipe separator
                    if (input.includes('|')) {
                        const movieList = input.split('|').map(name => name.trim()).filter(name => name);
                        if (movieList.length > 1) {
                            console.log(`\n🎬 Processing ${movieList.length} movies/TV shows...`);
                            const results = await this.checkMultipleMovies(movieList);
                            this.displayBatchResults(results);
                        } else {
                            await this.checkMovie(movieList[0]);
                        }
                    } else {
                        // Single movie
                        await this.checkMovie(input.trim());
                    }
                }
                
                console.log('\n' + '='.repeat(50));
                askForInput();
            });
        };

        askForInput();
    }
}

// Main execution
async function main() {
    const checker = new IMDBParentsGuideChecker();
    
    // Check if command line argument is provided
    const input = process.argv[2];
    
    if (input) {
        // Check if input contains pipe separator for multiple movies
        if (input.includes('|')) {
            const movieList = input.split('|').map(name => name.trim()).filter(name => name);
            if (movieList.length > 1) {
                console.log(`🎬 Processing ${movieList.length} movies/TV shows...`);
                const results = await checker.checkMultipleMovies(movieList);
                checker.displayBatchResults(results);
            } else {
                await checker.checkMovie(movieList[0]);
            }
        } else {
            // Single movie check
            await checker.checkMovie(input);
        }
    } else {
        // Interactive mode
        await checker.startInteractiveMode();
    }
}

// Run the program
if (require.main === module) {
    main().catch(console.error);
}

module.exports = IMDBParentsGuideChecker;