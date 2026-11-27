import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { workReportService } from '../services/workReport.service';

const router = Router();

router.use(authenticate);
router.use(authorize(['SUPER_ADMIN', 'ADMIN']));

router.get('/attendance/export', reportController.exportExcel);
router.get('/attendance/present', reportController.getPresentList);
router.get('/attendance/absent', reportController.getAbsentList);

// Work reports written by staff (check-out reports, field visit notes & surveys, camp reports) as Excel
router.get('/work-reports/export', async (req, res, next) => {
  try {
    const q = req.query;
    const { workbook, filename } = await workReportService.buildWorkbook(req.user!.organizationId, {
      from: typeof q.from === 'string' && q.from ? q.from : undefined,
      to: typeof q.to === 'string' && q.to ? q.to : undefined,
      category: typeof q.category === 'string' ? q.category : undefined,
      employeeId: typeof q.employeeId === 'string' && /^[0-9a-f-]{36}$/i.test(q.employeeId) ? q.employeeId : undefined,
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
});

export const reportRoutes = router;

