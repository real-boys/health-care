export class SentimentAnalyzer {
  constructor() {
    this.positiveWords = new Set([
      'excellent', 'amazing', 'wonderful', 'fantastic', 'great', 'good', 'satisfied',
      'helpful', 'professional', 'friendly', 'caring', 'compassionate', 'efficient',
      'quick', 'fast', 'responsive', 'attentive', 'knowledgeable', 'skilled', 'expert',
      'outstanding', 'superb', 'perfect', 'brilliant', 'exceptional', 'remarkable',
      'impressive', 'stellar', 'magnificent', 'splendid', 'terrific', 'awesome',
      'positive', 'beneficial', 'valuable', 'useful', 'effective', 'successful',
      'smooth', 'seamless', 'easy', 'convenient', 'comfortable', 'pleasant', 'enjoyable',
      'recommend', 'highly recommend', 'definitely recommend', 'would recommend',
      'love', 'loved', 'like', 'liked', 'appreciate', 'grateful', 'thankful',
      'happy', 'pleased', 'delighted', 'thrilled', 'excited', 'satisfied', 'content',
      'relieved', 'reassured', 'confident', 'trust', 'trusted', 'reliable', 'dependable'
    ]);

    this.negativeWords = new Set([
      'terrible', 'awful', 'horrible', 'disgusting', 'disappointing', 'poor', 'bad',
      'unsatisfied', 'dissatisfied', 'unhelpful', 'unprofessional', 'rude', 'uncaring',
      'incompetent', 'inefficient', 'slow', 'delayed', 'unresponsive', 'negligent',
      'inexperienced', 'unskilled', 'unqualified', 'useless', 'worthless', 'harmful',
      'dangerous', 'unsafe', 'risky', 'scary', 'intimidating', 'uncomfortable',
      'painful', 'unpleasant', 'unfriendly', 'cold', 'distant', 'arrogant', 'condescending',
      'disrespectful', 'ignorant', 'clueless', 'confused', 'chaotic', 'messy', 'dirty',
      'unclean', 'unsanitary', 'broken', 'damaged', 'faulty', 'defective', 'malfunctioning',
      'failed', 'failure', 'mistake', 'error', 'problem', 'issue', 'trouble', 'difficulty',
      'complaint', 'complain', 'angry', 'frustrated', 'annoyed', 'upset', 'worried',
      'anxious', 'stressed', 'disappointed', 'let down', 'betrayed', 'cheated', 'scammed',
      'overcharged', 'expensive', 'costly', 'unfair', 'unjust', 'wrong', 'incorrect',
      'inaccurate', 'misleading', 'deceptive', 'fake', 'false', 'dishonest', 'untrustworthy'
    ]);

    this.negationWords = new Set([
      'not', 'no', 'never', 'none', 'nothing', 'nowhere', 'neither', 'nor',
      'hardly', 'barely', 'scarcely', 'rarely', 'seldom', 'infrequently',
      'unhappy', 'unsatisfied', 'displeased', 'unimpressed', 'unconvinced',
      'disappointed', 'frustrated', 'annoyed', 'upset', 'worried', 'concerned'
    ]);

    this.intensifiers = new Map([
      ['extremely', 2.0],
      ['very', 1.5],
      ['really', 1.3],
      ['quite', 1.2],
      ['somewhat', 0.8],
      ['slightly', 0.7],
      ['barely', 0.5],
      ['hardly', 0.5],
      ['absolutely', 2.0],
      ['completely', 2.0],
      ['totally', 2.0],
      ['entirely', 2.0],
      ['perfectly', 2.0],
      ['highly', 1.8],
      ['incredibly', 1.8],
      ['surprisingly', 1.6],
      ['unusually', 1.6],
      ['exceptionally', 1.8],
      ['remarkably', 1.6],
      ['notably', 1.4],
      ['particularly', 1.4]
    ]);
  }

  analyze(text) {
    if (!text || typeof text !== 'string') {
      return {
        score: 0,
        sentiment: 'NEUTRAL',
        confidence: 0,
        words: {
          positive: 0,
          negative: 0,
          total: 0
        },
        details: {
          positiveWords: [],
          negativeWords: [],
          phrases: []
        }
      };
    }

    const cleanText = text.toLowerCase().replace(/[^\w\s]/g, ' ');
    const words = cleanText.split(/\s+/).filter(word => word.length > 0);
    
    let positiveScore = 0;
    let negativeScore = 0;
    let currentIntensifier = 1;
    
    const positiveWordsFound = [];
    const negativeWordsFound = [];
    const phrases = [];

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const nextWord = words[i + 1];
      const prevWord = words[i - 1];

      // Check for intensifiers
      if (this.intensifiers.has(word)) {
        currentIntensifier = this.intensifiers.get(word);
        continue;
      }

      // Check for negation
      const isNegated = this.isNegated(words, i);

      // Check positive words
      if (this.positiveWords.has(word)) {
        const score = isNegated ? -1 * currentIntensifier : currentIntensifier;
        if (score > 0) {
          positiveScore += score;
          positiveWordsFound.push(word);
        } else {
          negativeScore += Math.abs(score);
          negativeWordsFound.push(`not ${word}`);
        }
        currentIntensifier = 1;
      }
      // Check negative words
      else if (this.negativeWords.has(word)) {
        const score = isNegated ? -1 * currentIntensifier : currentIntensifier;
        if (score > 0) {
          negativeScore += score;
          negativeWordsFound.push(`not ${word}`);
        } else {
          positiveScore += Math.abs(score);
          positiveWordsFound.push(`not ${word}`);
        }
        currentIntensifier = 1;
      }
      // Check for phrases
      else if (nextWord) {
        const phrase = `${word} ${nextWord}`;
        if (this.positiveWords.has(phrase)) {
          const score = isNegated ? -1 * currentIntensifier : currentIntensifier;
          if (score > 0) {
            positiveScore += score;
            positiveWordsFound.push(phrase);
          } else {
            negativeScore += Math.abs(score);
            negativeWordsFound.push(`not ${phrase}`);
          }
          phrases.push(phrase);
          i++; // Skip next word
        } else if (this.negativeWords.has(phrase)) {
          const score = isNegated ? -1 * currentIntensifier : currentIntensifier;
          if (score > 0) {
            negativeScore += score;
            negativeWordsFound.push(`not ${phrase}`);
          } else {
            positiveScore += Math.abs(score);
            positiveWordsFound.push(`not ${phrase}`);
          }
          phrases.push(phrase);
          i++; // Skip next word
        } else {
          currentIntensifier = 1;
        }
      } else {
        currentIntensifier = 1;
      }
    }

    const totalWords = positiveWordsFound.length + negativeWordsFound.length;
    const netScore = positiveScore - negativeScore;
    const normalizedScore = totalWords > 0 ? netScore / Math.sqrt(totalWords) : 0;

    let sentiment = 'NEUTRAL';
    if (normalizedScore > 0.1) sentiment = 'POSITIVE';
    else if (normalizedScore > 0.5) sentiment = 'VERY_POSITIVE';
    else if (normalizedScore < -0.1) sentiment = 'NEGATIVE';
    else if (normalizedScore < -0.5) sentiment = 'VERY_NEGATIVE';

    const confidence = Math.min(Math.abs(normalizedScore) * 2, 1);

    return {
      score: Math.round(normalizedScore * 100) / 100,
      sentiment,
      confidence: Math.round(confidence * 100) / 100,
      words: {
        positive: positiveWordsFound.length,
        negative: negativeWordsFound.length,
        total: totalWords
      },
      details: {
        positiveWords: positiveWordsFound,
        negativeWords: negativeWordsFound,
        phrases: phrases
      }
    };
  }

  isNegated(words, index) {
    // Check previous 3 words for negation
    for (let i = Math.max(0, index - 3); i < index; i++) {
      if (this.negationWords.has(words[i])) {
        return true;
      }
    }
    return false;
  }

  extractKeywords(text, maxKeywords = 10) {
    if (!text || typeof text !== 'string') return [];

    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

    const wordFreq = {};
    words.forEach(word => {
      if (!this.isStopWord(word)) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });

    return Object.entries(wordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, maxKeywords)
      .map(([word, freq]) => ({ word, frequency: freq }));
  }

  isStopWord(word) {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'among', 'is', 'are',
      'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
      'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us',
      'them', 'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that',
      'these', 'those', 'what', 'which', 'who', 'when', 'where', 'why', 'how',
      'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
      'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
      'very', 'just', 'really', 'quite', 'also', 'even', 'now', 'then', 'well',
      'here', 'there', 'where', 'when', 'how', 'why', 'what', 'which', 'who'
    ]);
    
    return stopWords.has(word);
  }

  categorizeTopics(text) {
    const topics = {
      'care_quality': ['care', 'treatment', 'medical', 'health', 'diagnosis', 'therapy', 'medicine'],
      'staff_attitude': ['staff', 'doctor', 'nurse', 'receptionist', 'attitude', 'behavior', 'professional'],
      'wait_times': ['wait', 'waiting', 'delay', 'appointment', 'time', 'schedule', 'late'],
      'billing': ['bill', 'cost', 'price', 'insurance', 'payment', 'charge', 'fee', 'expensive'],
      'facilities': ['facility', 'building', 'room', 'clean', 'environment', 'equipment', 'parking'],
      'communication': ['communication', 'information', 'explain', 'listen', 'talk', 'answer', 'clear']
    };

    const textLower = text.toLowerCase();
    const foundTopics = [];

    Object.entries(topics).forEach(([topic, keywords]) => {
      const matches = keywords.filter(keyword => textLower.includes(keyword));
      if (matches.length > 0) {
        foundTopics.push({
          topic,
          keywords: matches,
          score: matches.length / keywords.length
        });
      }
    });

    return foundTopics.sort((a, b) => b.score - a.score);
  }

  generateSummary(text) {
    const analysis = this.analyze(text);
    const keywords = this.extractKeywords(text);
    const topics = this.categorizeTopics(text);

    return {
      sentiment: analysis.sentiment,
      score: analysis.score,
      confidence: analysis.confidence,
      keywords: keywords.slice(0, 5),
      topics: topics.slice(0, 3),
      wordCount: text.split(/\s+/).length,
      characterCount: text.length,
      hasPositiveContent: analysis.words.positive > 0,
      hasNegativeContent: analysis.words.negative > 0,
      isBalanced: Math.abs(analysis.words.positive - analysis.words.negative) <= 1
    };
  }

  batchAnalyze(texts) {
    return texts.map(text => this.generateSummary(text));
  }

  getSentimentDistribution(analyses) {
    const distribution = {
      VERY_POSITIVE: 0,
      POSITIVE: 0,
      NEUTRAL: 0,
      NEGATIVE: 0,
      VERY_NEGATIVE: 0
    };

    analyses.forEach(analysis => {
      if (distribution[analysis.sentiment] !== undefined) {
        distribution[analysis.sentiment]++;
      }
    });

    const total = analyses.length;
    return Object.entries(distribution).map(([sentiment, count]) => ({
      sentiment,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    }));
  }
}

// Singleton instance
export const sentimentAnalyzer = new SentimentAnalyzer();
