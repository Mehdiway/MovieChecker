# 🎬 IMDB Parents Guide Checker

A Node.js tool that automatically checks IMDB's Parents Guide for movies and TV shows to determine their Sex & Nudity content ratings. Perfect for parents, educators, and anyone who wants to quickly assess the appropriateness of media content.

## ✨ Features

- **🔍 Smart Movie Search**: Automatically finds movies/TV shows on IMDB using intelligent search
- **📋 Parents Guide Analysis**: Extracts Sex & Nudity ratings from IMDB's Parents Guide
- **📊 Content Categorization**: Automatically categorizes content as "None", "Mild", or "Other"
- **📝 Detailed Analysis**: For "Mild" content, provides specific reasons (kissing, brief nudity, etc.)
- **🎯 Batch Processing**: Check multiple movies at once using pipe separators
- **⚡ Rate Limiting**: Built-in rate limiting to respect IMDB's servers
- **🔄 Interactive Mode**: User-friendly interactive interface
- **📈 Batch Results**: Comprehensive summary reports for multiple movies

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- pnpm (recommended) or npm

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/MovieChecker.git
   cd MovieChecker
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   # or
   npm install
   ```

3. **Run the checker**
   ```bash
   node imdb-checker.js "Movie Name"
   ```

## 📖 Usage

### Single Movie Check

```bash
node imdb-checker.js "The Matrix"
```

### Multiple Movies (Batch Mode)

```bash
node imdb-checker.js "The Matrix | Finding Nemo | Toy Story"
```

### Interactive Mode

```bash
node imdb-checker.js
```

Then enter movie names when prompted. Use `|` to separate multiple movies.

## 📊 Output Examples

### Single Movie Result

```
=== Checking: The Matrix ===
✅ Found: The Matrix (1999)
🔗 IMDB URL: https://www.imdb.com/title/tt0133093/
📋 Parents Guide URL: https://www.imdb.com/title/tt0133093/parentalguide/
🔞 Sex & Nudity Rating: Mild
📝 Mild Content Reasons:
   1. Contains kissing scenes
   2. Brief nudity shown
⚠️  RESULT: Sex & Nudity is rated as "Mild"
```

### Batch Results Summary

```
📊 BATCH RESULTS SUMMARY
================================================================================

✅ Movies/Shows with "None" Sex & Nudity rating: 2
  1. Finding Nemo (2003)
     📋 Parents Guide: https://www.imdb.com/title/tt0266543/parentalguide/
  2. Toy Story (1995)
     📋 Parents Guide: https://www.imdb.com/title/tt0114709/parentalguide/

⚠️  Movies/Shows with "Mild" Sex & Nudity rating: 1
  1. The Matrix (1999)
     📋 Parents Guide: https://www.imdb.com/title/tt0133093/parentalguide/
     📝 Mild Content Reasons:
        • Contains kissing scenes
        • Brief nudity shown

📊 CATEGORY BREAKDOWN:
   ✅ None: 2 (67%)
   ⚠️  Mild: 1 (33%)
   ❌ Other: 0 (0%)
   ⚠️  Errors: 0 (0%)

📈 Total processed: 3
🎯 Success rate: 100%
🔍 Family-friendly (None + Mild): 3 (100%)
```

## 🔧 Technical Details

### Content Categories

- **✅ None**: No sexual content or nudity
- **⚠️ Mild**: Light sexual content (kissing, brief nudity, innuendo)
- **❌ Other**: More explicit content (moderate, severe ratings)

### Mild Content Detection

The tool analyzes "Mild" content.

### Rate Limiting

- **Minimum delay**: 0.5 seconds between requests
- **Maximum delay**: 1 second between requests
- **Rate limit**: 30 requests per minute
- **Random delays**: Prevents detection as automated traffic

## 🛠️ Dependencies

- **axios**: HTTP client for making requests to IMDB
- **cheerio**: HTML parsing and DOM manipulation
- **readline**: Interactive command-line interface

## 📋 Project Structure

```
MovieChecker/
├── imdb-checker.js      # Main application file
├── package.json         # Project dependencies and metadata
├── pnpm-lock.yaml      # Lock file for reproducible builds
└── README.md           # This file
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## ⚠️ Important Notes

- **Respectful Usage**: This tool includes rate limiting to be respectful to IMDB's servers
- **Terms of Service**: Please respect IMDB's terms of service when using this tool
- **Educational Purpose**: This tool is designed for educational and informational purposes
- **No Guarantees**: Ratings are based on IMDB's Parents Guide content and may not be comprehensive

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- IMDB for providing the Parents Guide content
- The open-source community for the excellent libraries used in this project

---

**Made with ❤️ for parents and educators who want to make informed media choices**
