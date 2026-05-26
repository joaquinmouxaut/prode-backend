"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PointsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
let PointsService = class PointsService {
    calculatePredictionPoints(prediction, match) {
        if (match.homeGoals === null || match.awayGoals === null) {
            return 0;
        }
        const realHome = match.homeGoals;
        const realAway = match.awayGoals;
        const predHome = prediction.homeGoals;
        const predAway = prediction.awayGoals;
        let basePoints = 0;
        if (this.getOutcome(predHome, predAway) === this.getOutcome(realHome, realAway)) {
            basePoints += 4;
        }
        if (predHome === realHome && predAway === realAway) {
            basePoints += 4;
        }
        if (predHome - predAway === realHome - realAway) {
            basePoints += 2;
        }
        if (predHome === realHome) {
            basePoints += 1;
        }
        if (predAway === realAway) {
            basePoints += 1;
        }
        return basePoints * this.getPhaseMultiplier(match.phase);
    }
    getOutcome(homeGoals, awayGoals) {
        if (homeGoals > awayGoals) {
            return 'H';
        }
        if (homeGoals < awayGoals) {
            return 'A';
        }
        return 'D';
    }
    getPhaseMultiplier(phase) {
        if (phase === client_1.Phase.FINAL) {
            return 3;
        }
        if (phase === client_1.Phase.KNOCKOUT) {
            return 2;
        }
        return 1;
    }
};
exports.PointsService = PointsService;
exports.PointsService = PointsService = __decorate([
    (0, common_1.Injectable)()
], PointsService);
//# sourceMappingURL=points.service.js.map