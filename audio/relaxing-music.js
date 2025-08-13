// Relaxing Music Generator using Web Audio API
class RelaxingMusicGenerator {
    constructor() {
        this.audioContext = null;
        this.isPlaying = false;
        this.oscillators = [];
        this.gainNodes = [];
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

    createRelaxingTone(frequency, type = 'sine', volume = 0.1) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = type;
        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        
        // Add subtle vibrato
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
            frequency * 1.01, 
            this.audioContext.currentTime + 2
        );
        
        return { oscillator, gainNode };
    }

    play() {
        if (!this.audioContext || this.isPlaying) return;
        
        this.isPlaying = true;
        
        // Create multiple tones for a relaxing chord
        const frequencies = [220, 329.63, 440, 554.37]; // A major chord
        const types = ['sine', 'triangle', 'sine', 'triangle'];
        const volumes = [0.05, 0.03, 0.04, 0.02];
        
        frequencies.forEach((freq, index) => {
            const { oscillator, gainNode } = this.createRelaxingTone(freq, types[index], volumes[index]);
            
            this.oscillators.push(oscillator);
            this.gainNodes.push(gainNode);
            
            oscillator.start();
        });
        
        // Gradually fade in
        this.gainNodes.forEach(gainNode => {
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(
                gainNode.gain.value, 
                this.audioContext.currentTime + 1
            );
        });
    }

    stop() {
        if (!this.isPlaying) return;
        
        this.isPlaying = false;
        
        // Gradually fade out
        this.gainNodes.forEach(gainNode => {
            gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.5);
        });
        
        // Stop oscillators after fade out
        setTimeout(() => {
            this.oscillators.forEach(oscillator => oscillator.stop());
            this.oscillators = [];
            this.gainNodes = [];
        }, 500);
    }

    setVolume(volume) {
        this.gainNodes.forEach(gainNode => {
            gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        });
    }
}

// Export for use in main script
window.RelaxingMusicGenerator = RelaxingMusicGenerator;

