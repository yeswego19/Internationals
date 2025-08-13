// Focus Music Generator using Web Audio API
class FocusMusicGenerator {
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

    createFocusTone(frequency, type = 'sine', volume = 0.06) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = type;
        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        
        // Add subtle frequency modulation for focus
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
            frequency * 1.005, 
            this.audioContext.currentTime + 4
        );
        
        return { oscillator, gainNode };
    }

    play() {
        if (!this.audioContext || this.isPlaying) return;
        
        this.isPlaying = true;
        
        // Create focus-inducing frequencies (alpha brain waves)
        const frequencies = [432, 528, 639, 741]; // Focus frequencies
        const types = ['sine', 'triangle', 'sine', 'triangle'];
        const volumes = [0.04, 0.03, 0.04, 0.02];
        
        frequencies.forEach((freq, index) => {
            const { oscillator, gainNode } = this.createFocusTone(freq, types[index], volumes[index]);
            
            this.oscillators.push(oscillator);
            this.gainNodes.push(gainNode);
            
            oscillator.start();
        });
        
        // Add slow, steady rhythm for concentration
        this.interval = setInterval(() => {
            this.gainNodes.forEach((gainNode, index) => {
                const baseVolume = volumes[index];
                const focusVolume = baseVolume * (0.8 + Math.sin(Date.now() * 0.001) * 0.2);
                gainNode.gain.setValueAtTime(focusVolume, this.audioContext.currentTime);
            });
        }, 1000);
        
        // Gradually fade in
        this.gainNodes.forEach(gainNode => {
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(
                gainNode.gain.value, 
                this.audioContext.currentTime + 2
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
            gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 1);
        });
        
        // Stop oscillators after fade out
        setTimeout(() => {
            this.oscillators.forEach(oscillator => oscillator.stop());
            this.oscillators = [];
            this.gainNodes = [];
        }, 1000);
    }

    setVolume(volume) {
        this.gainNodes.forEach(gainNode => {
            gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        });
    }
}

// Export for use in main script
window.FocusMusicGenerator = FocusMusicGenerator;
