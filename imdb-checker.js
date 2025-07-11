const axios = require('axios');
const cheerio = require('cheerio');
const readline = require('readline');

class IMDBParentsGuideChecker {
    constructor() {
        this.baseURL = 'https://www.imdb.com';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        };
    }

    async searchMovie(query) {
        try {
            const searchURL = `${this.baseURL}/find?q=${encodeURIComponent(query)}&s=tt&ttype=ft,tv`;
            console.log(`Searching for: ${query}`);
            
            const response = await axios.get(searchURL, { headers: this.headers });
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
            const parentsGuideURL = `${this.baseURL}/title/${imdbID}/parentalguide/`;
            console.log(`Checking parents guide: ${parentsGuideURL}`);
            
            const response = await axios.get(parentsGuideURL, { headers: this.headers });
            const $ = cheerio.load(response.data);
            
            // Look for Sex & Nudity section
            let sexNudityRating = null;
            
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
                }
            }
            
            return {
                parentsGuideURL,
                sexNudityRating: sexNudityRating || 'Unknown'
            };
            
        } catch (error) {
            console.error('Error checking parents guide:', error.message);
            return null;
        }
    }

    async checkMovie(movieName) {
        console.log(`\n=== Checking: ${movieName} ===`);
        
        // Search for the movie
        const searchResult = await this.searchMovie(movieName);
        
        if (!searchResult) {
            console.log('❌ Movie not found on IMDB');
            return;
        }
        
        console.log(`✅ Found: ${searchResult.title} (${searchResult.year})`);
        console.log(`🔗 IMDB URL: ${searchResult.url}`);
        
        // Check parents guide
        const parentsGuide = await this.checkParentsGuide(searchResult.imdbID);
        
        if (!parentsGuide) {
            console.log('❌ Could not access parents guide');
            return;
        }
        
        console.log(`📋 Parents Guide URL: ${parentsGuide.parentsGuideURL}`);
        console.log(`🔞 Sex & Nudity Rating: ${parentsGuide.sexNudityRating}`);
        
        // Check if rating is "None"
        const isNone = parentsGuide.sexNudityRating.toLowerCase().includes('none');
        
        if (isNone) {
            console.log('✅ RESULT: Sex & Nudity is rated as "None"');
        } else {
            console.log('❌ RESULT: Sex & Nudity is NOT rated as "None"');
        }
        
        return {
            title: searchResult.title,
            year: searchResult.year,
            imdbURL: searchResult.url,
            parentsGuideURL: parentsGuide.parentsGuideURL,
            sexNudityRating: parentsGuide.sexNudityRating,
            isNone: isNone
        };
    }

    async startInteractiveMode() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log('🎬 IMDB Parents Guide Checker');
        console.log('Enter movie/TV show names to check their Sex & Nudity rating');
        console.log('Type "exit" to quit\n');

        const askForInput = () => {
            rl.question('Enter movie/TV show name: ', async (movieName) => {
                if (movieName.toLowerCase() === 'exit') {
                    rl.close();
                    return;
                }
                
                if (movieName.trim()) {
                    await this.checkMovie(movieName.trim());
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
    const movieName = process.argv[2];
    
    if (movieName) {
        // Single movie check
        await checker.checkMovie(movieName);
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