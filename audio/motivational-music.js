// Motivational Music Generator using Web Audio API
class MotivationalMusicGenerator {
    constructor() {
        this.audioContext = null;
        this.isPlaying = false;
        this.oscillators = [];
        this.gainNodes = [];
        this.interval = null;
    }

    async initialize() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            return true;
        } catch (error) {
            console.error('Web Audio API not supported:', error);
            return false;
        }
    }

    createMotivationalTone(frequency, type = 'square', volume = 0.08) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = type;
        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        
        return { oscillator, gainNode };
    }

    play() {
        if (!this.audioContext || this.isPlaying) return;
        
        this.isPlaying = true;
        
        // Create energetic chord progression
        const frequencies = [261.63, 329.63, 392, 523.25]; // C major chord + high C
        const types = ['square', 'sawtooth', 'square', 'triangle'];
        const volumes = [0.06, 0.04, 0.05, 0.03];
        
        frequencies.forEach((freq, index) => {
            const { oscillator, gainNode } = this.createMotivationalTone(freq, types[index], volumes[index]);
            
            this.oscillators.push(oscillator);
            this.gainNodes.push(gainNode);
            
            oscillator.start();
        });
        
        // Add rhythmic pattern
        this.interval = setInterval(() => {
            this.gainNodes.forEach((gainNode, index) => {
                const baseVolume = volumes[index];
                const pulseVolume = baseVolume * (0.5 + Math.random() * 0.5);
                gainNode.gain.setValueAtTime(pulseVolume, this.audioContext.currentTime);
            });
        }, 200);
        
        // Gradually fade in
        this.gainNodes.forEach(gainNode => {
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(
                gainNode.gain.value, 
                this.audioContext.currentTime + 0.5
            );
        });
    }

    stop() {
        if (!this.isPlaying) return;
        
        this.isPlaying = false;
        
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        
        // Gradually fade out
        this.gainNodes.forEach(gainNode => {
            gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.3);
        });
        
        // Stop oscillators after fade out
        setTimeout(() => {
            this.oscillators.forEach(oscillator => oscillator.stop());
            this.oscillators = [];
            this.gainNodes = [];
        }, 300);
    }

    setVolume(volume) {
        this.gainNodes.forEach(gainNode => {
            gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        });
    }
}

// Export for use in main script
window.MotivationalMusicGenerator = MotivationalMusicGenerator;
