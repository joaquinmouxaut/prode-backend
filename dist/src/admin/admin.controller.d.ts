import { AdminService } from './admin.service';
import { SetMatchResultDto } from './dto/set-match-result.dto';
export declare class AdminController {
    private readonly adminService;
    constructor(adminService: AdminService);
    setMatchResult(id: number, body: SetMatchResultDto): Promise<{
        matchId: number;
        recalculatedPredictions: number;
        recalculatedUsers: number;
    }>;
}
