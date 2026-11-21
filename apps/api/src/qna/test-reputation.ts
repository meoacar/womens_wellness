/**
 * Reputation System Test Script
 * 
 * Bu script reputation sisteminin tüm özelliklerini test eder:
 * - Reputation puanı hesaplama
 * - Best answer seçildiğinde puan kazanma
 * - Upvote/downvote ile puan kazanma/kaybetme
 * - Badge kazanma sistemi
 * - Leaderboard
 * - Reputation history
 */

import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

// Test kullanıcıları
let authToken1: string;
let authToken2: string;
let userId1: string;
let userId2: string;

// Test verileri
let questionId: string;
let answerId1: string;
let answerId2: string;

async function login(email: string, password: string) {
    try {
        const response = await axios.post(`${API_URL}/auth/login`, {
            email,
            password,
        });
        return {
            token: response.data.access_token,
            userId: response.data.user.id,
        };
    } catch (error: any) {
        console.error('❌ Login hatası:', error.response?.data || error.message);
        throw error;
    }
}

async function createQuestion(token: string, data: any) {
    try {
        const response = await axios.post(`${API_URL}/qna/questions`, data, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error: any) {
        console.error('❌ Soru oluşturma hatası:', error.response?.data || error.message);
        throw error;
    }
}

async function createAnswer(token: string, questionId: string, content: string) {
    try {
        const response = await axios.post(
            `${API_URL}/qna/questions/${questionId}/answers`,
            { content },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data;
    } catch (error: any) {
        console.error('❌ Cevap oluşturma hatası:', error.response?.data || error.message);
        throw error;
    }
}

async function markBestAnswer(token: string, questionId: string, answerId: string) {
    try {
        const response = await axios.post(
            `${API_URL}/qna/questions/${questionId}/answers/${answerId}/mark-best`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data;
    } catch (error: any) {
        console.error('❌ Best answer işaretleme hatası:', error.response?.data || error.message);
        throw error;
    }
}

async function voteAnswer(token: string, answerId: string, voteType: 'UPVOTE' | 'DOWNVOTE') {
    try {
        const response = await axios.post(
            `${API_URL}/qna/answers/${answerId}/vote`,
            { voteType },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data;
    } catch (error: any) {
        console.error('❌ Oy verme hatası:', error.response?.data || error.message);
        throw error;
    }
}

async function getMyReputation(token: string) {
    try {
        const response = await axios.get(`${API_URL}/qna/reputation/me`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error: any) {
        console.error('❌ Reputation getirme hatası:', error.response?.data || error.message);
        throw error;
    }
}

async function getReputationHistory(token: string) {
    try {
        const response = await axios.get(`${API_URL}/qna/reputation/me/history`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error: any) {
        console.error('❌ Reputation history getirme hatası:', error.response?.data || error.message);
        throw error;
    }
}

async function getMyBadges(token: string) {
    try {
        const response = await axios.get(`${API_URL}/qna/reputation/me/badges`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error: any) {
        console.error('❌ Badge getirme hatası:', error.response?.data || error.message);
        throw error;
    }
}

async function getLeaderboard(token: string) {
    try {
        const response = await axios.get(`${API_URL}/qna/reputation/leaderboard/top`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error: any) {
        console.error('❌ Leaderboard getirme hatası:', error.response?.data || error.message);
        throw error;
    }
}

async function getAllBadges(token: string) {
    try {
        const response = await axios.get(`${API_URL}/qna/reputation/badges/all`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error: any) {
        console.error('❌ Tüm badge\'leri getirme hatası: ', error.response?.data || error.message);
        throw error;
    }
}

async function runTests() {
    console.log('🚀 Reputation System Test Başlıyor...\n');

    try {
        // 1. Login
        console.log('1️⃣  Kullanıcı girişleri yapılıyor...');
        const user1 = await login('test@example.com', 'password123');
        authToken1 = user1.token;
        userId1 = user1.userId;
        console.log('✅ User 1 giriş yaptı:', userId1);

        const user2 = await login('test2@example.com', 'password123');
        authToken2 = user2.token;
        userId2 = user2.userId;
        console.log('✅ User 2 giriş yaptı:', userId2);
        console.log('');

        // 2. Tüm badge'leri listele
        console.log('2️⃣  Tüm badge\'ler listeleniyor...');
        const allBadges = await getAllBadges(authToken1);
        console.log(`✅ Toplam ${allBadges.length} badge bulundu`);
        console.log('Badge örnekleri:', allBadges.slice(0, 3).map((b: any) => b.nameTr));
        console.log('');

        // 3. İlk reputation durumu
        console.log('3️⃣  Başlangıç reputation durumu kontrol ediliyor...');
        let reputation1 = await getMyReputation(authToken1);
        console.log('✅ User 1 reputation:', {
            totalPoints: reputation1.totalPoints,
            questionsAsked: reputation1.questionsAsked,
            answersGiven: reputation1.answersGiven,
            bestAnswers: reputation1.bestAnswers,
        });
        console.log('');

        // 4. Soru oluştur (User 1)
        console.log('4️⃣  User 1 soru oluşturuyor...');
        const question = await createQuestion(authToken1, {
            title: 'Reputation Test Sorusu',
            content: 'Bu soru reputation sistemini test etmek için oluşturuldu.',
            category: 'GENERAL',
            tags: ['test', 'reputation'],
        });
        questionId = question.id;
        console.log('✅ Soru oluşturuldu:', questionId);
        console.log('');

        // 5. Reputation güncellemesini kontrol et
        console.log('5️⃣  Soru sonrası reputation kontrol ediliyor...');
        reputation1 = await getMyReputation(authToken1);
        console.log('✅ User 1 reputation güncellendi:', {
            totalPoints: reputation1.totalPoints,
            questionsAsked: reputation1.questionsAsked,
        });
        console.log('');

        // 6. İlk badge kontrolü
        console.log('6️⃣  İlk badge kontrol ediliyor...');
        const badges1 = await getMyBadges(authToken1);
        console.log(`✅ User 1 badge sayısı: ${badges1.length}`);
        if (badges1.length > 0) {
            console.log('Kazanılan badge\'ler:', badges1.map((b: any) => b.nameTr));
        }
        console.log('');

        // 7. Cevap oluştur (User 2)
        console.log('7️⃣  User 2 cevap veriyor...');
        const answer1 = await createAnswer(
            authToken2,
            questionId,
            'Bu bir test cevabıdır. Reputation sistemi çalışıyor mu?'
        );
        answerId1 = answer1.id;
        console.log('✅ Cevap 1 oluşturuldu:', answerId1);
        console.log('');

        // 8. User 2 reputation kontrol
        console.log('8️⃣  Cevap sonrası User 2 reputation kontrol ediliyor...');
        let reputation2 = await getMyReputation(authToken2);
        console.log('✅ User 2 reputation:', {
            totalPoints: reputation2.totalPoints,
            answersGiven: reputation2.answersGiven,
        });
        console.log('');

        // 9. İkinci cevap oluştur (User 1)
        console.log('9️⃣  User 1 de cevap veriyor...');
        const answer2 = await createAnswer(
            authToken1,
            questionId,
            'Ben de cevap veriyorum. Kendi soruma cevap verebilir miyim?'
        );
        answerId2 = answer2.id;
        console.log('✅ Cevap 2 oluşturuldu:', answerId2);
        console.log('');

        // 10. Upvote ver (User 1 -> User 2'nin cevabına)
        console.log('🔟 User 1, User 2\'nin cevabına upvote veriyor...');
        await voteAnswer(authToken1, answerId1, 'UPVOTE');
        console.log('✅ Upvote verildi');
        console.log('');

        // 11. User 2 reputation kontrol (upvote sonrası)
        console.log('1️⃣1️⃣  Upvote sonrası User 2 reputation kontrol ediliyor...');
        reputation2 = await getMyReputation(authToken2);
        console.log('✅ User 2 reputation (upvote sonrası):', {
            totalPoints: reputation2.totalPoints,
            upvotesReceived: reputation2.upvotesReceived,
        });
        console.log('');

        // 12. Best answer seç (User 1 -> User 2'nin cevabını)
        console.log('1️⃣2️⃣  User 1, User 2\'nin cevabını best answer olarak seçiyor...');
        await markBestAnswer(authToken1, questionId, answerId1);
        console.log('✅ Best answer seçildi');
        console.log('');

        // 13. User 2 reputation kontrol (best answer sonrası)
        console.log('1️⃣3️⃣  Best answer sonrası User 2 reputation kontrol ediliyor...');
        reputation2 = await getMyReputation(authToken2);
        console.log('✅ User 2 reputation (best answer sonrası):', {
            totalPoints: reputation2.totalPoints,
            bestAnswers: reputation2.bestAnswers,
        });
        console.log('');

        // 14. Badge kontrolü (User 2)
        console.log('1️⃣4️⃣  User 2 badge\'leri kontrol ediliyor...');
        const badges2 = await getMyBadges(authToken2);
        console.log(`✅ User 2 badge sayısı: ${badges2.length}`);
        if (badges2.length > 0) {
            console.log('Kazanılan badge\'ler:', badges2.map((b: any) => b.nameTr));
        }
        console.log('');

        // 15. Reputation history
        console.log('1️⃣5️⃣  User 2 reputation history kontrol ediliyor...');
        const history = await getReputationHistory(authToken2);
        console.log(`✅ Toplam ${history.length} reputation history kaydı`);
        console.log('Son 3 kayıt:');
        history.slice(0, 3).forEach((h: any) => {
            console.log(`  - ${h.reason}: ${h.points > 0 ? '+' : ''}${h.points} puan`);
        });
        console.log('');

        // 16. Leaderboard
        console.log('1️⃣6️⃣  Leaderboard kontrol ediliyor...');
        const leaderboard = await getLeaderboard(authToken1);
        console.log(`✅ Leaderboard'da ${leaderboard.length} kullanıcı`);
        console.log('Top 3:');
        leaderboard.slice(0, 3).forEach((entry: any) => {
            console.log(`  ${entry.rank}. ${entry.displayName}: ${entry.totalPoints} puan`);
        });
        console.log('');

        // 17. Downvote test (User 2 -> User 1'in cevabına)
        console.log('1️⃣7️⃣  User 2, User 1\'in cevabına downvote veriyor...');
        await voteAnswer(authToken2, answerId2, 'DOWNVOTE');
        console.log('✅ Downvote verildi');
        console.log('');

        // 18. User 1 reputation kontrol (downvote sonrası)
        console.log('1️⃣8️⃣  Downvote sonrası User 1 reputation kontrol ediliyor...');
        reputation1 = await getMyReputation(authToken1);
        console.log('✅ User 1 reputation (downvote sonrası):', {
            totalPoints: reputation1.totalPoints,
        });
        console.log('');

        console.log('✅ TÜM TESTLER BAŞARIYLA TAMAMLANDI! 🎉\n');
        console.log('📊 ÖZET:');
        console.log(`User 1: ${reputation1.totalPoints} puan, ${reputation1.questionsAsked} soru, ${reputation1.answersGiven} cevap`);
        console.log(`User 2: ${reputation2.totalPoints} puan, ${reputation2.answersGiven} cevap, ${reputation2.bestAnswers} best answer`);

    } catch (error: any) {
        console.error('\n❌ TEST HATASI:', error.message);
        if (error.response?.data) {
            console.error('Hata detayı:', error.response.data);
        }
        process.exit(1);
    }
}

// Test'i çalıştır
runTests();
