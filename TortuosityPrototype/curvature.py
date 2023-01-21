from scipy import interpolate
from mpl_toolkits.mplot3d import Axes3D
import matplotlib.pyplot as plt
import matplotlib as mpl
import numpy as np
import math
from numpy import linalg as LA

mpl.rcParams['savefig.dpi'] = 300
show_derivatives = 0

remove_pts_num = 3


num_sample_pts = 200


fig2 = plt.figure(2)

if show_derivatives == 0:
    ax3d = plt.subplot2grid((1, 2), (0, 0), projection='3d')
    plt.axis('off')
    ax3d.axis('equal')

    ax3d.text2D(0.3, 0, "CIRCLE", transform=ax3d.transAxes)


    plotCurvature = plt.subplot2grid((1, 2), (0, 1), colspan=2)
    plotCurvature.set_xlabel('C-norm of curvature error')

else:
    ax3d = plt.subplot2grid((3,5), (0,0), colspan=2, rowspan=2,projection='3d')
    ax3d.axis('equal')

    plotCurvature = plt.subplot2grid((3,5), (2,0), colspan=2)
    plotCurvature.set_xlabel('CURVATURE')

    plotX = plt.subplot2grid((3,5), (0,2))
    plotY = plt.subplot2grid((3,5), (1,2))
    plotZ = plt.subplot2grid((3,5), (2,2))

    plotDX = plt.subplot2grid((3,5), (0,3))
    plotDY = plt.subplot2grid((3,5), (1,3))
    plotDZ = plt.subplot2grid((3,5), (2,3))

    plotDX.spines['right'].set_color('none')
    plotDX.spines['top'].set_color('none')
    plotDX.xaxis.set_ticks_position('bottom')
    plotDX.spines['bottom'].set_position(('data',0)) # set position of x spine to x=0
    plotDX.yaxis.set_ticks_position('left')
    plotDX.spines['left'].set_position(('data',0))   # set position of y spine to y=0

    plotDY.spines['right'].set_color('none')
    plotDY.spines['top'].set_color('none')
    plotDY.xaxis.set_ticks_position('bottom')
    plotDY.spines['bottom'].set_position(('data',0)) # set position of x spine to x=0
    plotDY.yaxis.set_ticks_position('left')
    plotDY.spines['left'].set_position(('data',0))   # set position of y spine to y=0

    plotDZ.spines['right'].set_color('none')
    plotDZ.spines['top'].set_color('none')
    plotDZ.xaxis.set_ticks_position('bottom')
    plotDZ.spines['bottom'].set_position(('data',0)) # set position of x spine to x=0
    plotDZ.yaxis.set_ticks_position('left')
    plotDZ.spines['left'].set_position(('data',0))   # set position of y spine to y=0


    plotDDX = plt.subplot2grid((3,5), (0,4))
    plotDDY = plt.subplot2grid((3,5), (1,4))
    plotDDZ = plt.subplot2grid((3,5), (2,4))

    plotDDX.spines['right'].set_color('none')
    plotDDX.spines['top'].set_color('none')
    plotDDX.xaxis.set_ticks_position('bottom')
    plotDDX.spines['bottom'].set_position(('data',0)) # set position of x spine to x=0
    plotDDX.yaxis.set_ticks_position('left')
    plotDDX.spines['left'].set_position(('data',0))   # set position of y spine to y=0

    plotDDY.spines['right'].set_color('none')
    plotDDY.spines['top'].set_color('none')
    plotDDY.xaxis.set_ticks_position('bottom')
    plotDDY.spines['bottom'].set_position(('data',0)) # set position of x spine to x=0
    plotDDY.yaxis.set_ticks_position('left')
    plotDDY.spines['left'].set_position(('data',0))   # set position of y spine to y=0

    plotDDZ.spines['right'].set_color('none')
    plotDDZ.spines['top'].set_color('none')
    plotDDZ.xaxis.set_ticks_position('bottom')
    plotDDZ.spines['bottom'].set_position(('data',0)) # set position of x spine to x=0
    plotDDZ.yaxis.set_ticks_position('left')
    plotDDZ.spines['left'].set_position(('data',0))   # set position of y spine to y=0


def colormap(tmp):
    minVal = min(tmp)
    maxVal = max(tmp)
    segment = maxVal - minVal

    array = []
    for val in tmp:
        factor = 1 - ((val - minVal) / segment)
        array.append('#%02x%02x%02x' % (255.0 , 255.0 * factor, 255.0 * factor) )
        # 255.0 * (1 - (val - minVal) / segment)))
    return np.array(array)

iter=0

norms = []
radii = []
for it in range(1, 5000, 1):
    radius = 0.01 * it
    radii.append(radius)
    s_sample = np.linspace(0, 2.0 * 3.14, num_sample_pts)
    x_sample = radius * np.cos(s_sample)
    y_sample = radius * np.sin(s_sample)
    z_sample = 0.0 * s_sample

    #ax3d.plot(x_sample, y_sample, z_sample, 'r', alpha=1)

    dx_dt = np.gradient(x_sample)
    dy_dt = np.gradient(y_sample)
    dz_dt = np.gradient(z_sample)

    ds_dt_sqrd = (dx_dt * dx_dt + dy_dt * dy_dt + dz_dt * dz_dt)
    # d2s_dt2 = np.gradient(ds_dt)
    d2x_dt2 = np.gradient(dx_dt)
    d2y_dt2 = np.gradient(dy_dt)
    d2z_dt2 = np.gradient(dz_dt)

    curvature = np.sqrt(((d2z_dt2 * dy_dt - d2y_dt2 * dz_dt) ** 2.0 +
                         (d2x_dt2 * dz_dt - d2z_dt2 * dx_dt) ** 2.0 +
                         (d2y_dt2 * dx_dt - d2x_dt2 * dy_dt) ** 2.0) / (ds_dt_sqrd ** 3.0))
    # print (curvature)

    # plot numerical curvature
    # plotCurvature.plot(curvature[remove_pts_num:-remove_pts_num], 'k')
    #plotCurvature.plot(curvature[2:-2], 'k')

    # plot analytical curvature
    curvatureAnal = 1.0 / radius + 0.0 * s_sample
    #plotCurvature.plot(curvatureAnal[2:-2], 'r')
    print ("C-norm = " + str(LA.norm(curvature[2:-2] - curvatureAnal[2:-2], ord=np.inf)))
    norms.append(LA.norm(curvature[2:-2] - curvatureAnal[2:-2], ord=np.inf))
    # print (plotCurvature.axis())

    if show_derivatives:
        dx_label, = plotDX.plot(dx_dt, label='dx/dt')
        plotDX.legend([dx_label], ['dx/dt'])
        x_label, = plotX.plot(x_sample, label='x')
        plotX.legend([x_label], ['X'])
        ddx_label, = plotDDX.plot(d2x_dt2, label='ddx')
        plotDDX.legend([ddx_label], ['d2X/dt2'])

        dy_label, = plotDY.plot(dy_dt, label='dy/dt')
        plotDY.legend([dy_label], ['dy/dt'])
        y_label, = plotY.plot(y_sample, label='Y')
        plotY.legend([y_label], ['Y'])
        ddy_label, = plotDDY.plot(d2y_dt2, label='DDY')
        plotDDY.legend([ddy_label], ['d2Y/dt2'])

        dz_label, = plotDZ.plot(dz_dt, label='dz/dt')
        plotDZ.legend([dz_label], ['dz/dt'])
        z_label, = plotZ.plot(z_sample, label='Z')
        plotZ.legend([z_label], ['Z'])
        ddz_label, = plotDDZ.plot(d2z_dt2, label='DDZ')
        plotDDZ.legend([ddz_label], ['d2Z/dt2'])

# green line and dots show fitted curve
#ax3.scatter(x_sample[remove_pts_num:-remove_pts_num], y_sample[remove_pts_num:-remove_pts_num],
#                  z_sample[remove_pts_num:-remove_pts_num], edgecolor='None',
#                  c=colormap(curvature[remove_pts_num:-remove_pts_num]), s=50)

# t_component = np.array([d2s_dt2] * 2).transpose()
# n_component = np.array([curvature * ds_dt * ds_dt] * 2).transpose()

plotCurvature.semilogy()
plotCurvature.plot(radii,norms, 'k')
print (len(norms), len(radii))
print (radii[-1])
plt.show()

'''
    step = 7
    for j in range(step, len(centerline)-step-1):
        fig2 = plt.figure(2)
        ax3d = fig2.add_subplot(111, projection='3d')

        num_sample_pts = step*2
        x_sample = [centerline[i][0] for i in range(j-step, j+step-1)]
        y_sample = [centerline[i][1] for i in range(j-step, j+step-1)]
        z_sample = [centerline[i][2] for i in range(j-step, j+step-1)]

        # tck - is a tuple(t, c, k) containing the vector of knots, the B - spline coefficients, and the degree of the spline.
        # u - is an array of the values of the parameter
        tck, u = interpolate.splprep([x_sample, y_sample, z_sample], k=5, s=2)
        #print (tck[2])

        x_knots, y_knots, z_knots = interpolate.splev(tck[0], tck)
        # u_sample = np.linspace(0,1,num_true_pts)
        u_sample = np.linspace(0, 1, num_sample_pts)
        print ("num_sample_pts = " + str(num_sample_pts))
        x_sample, y_sample, z_sample = interpolate.splev(u_sample, tck)


    # blue line shows true helix
    # ax3d.plot(x_true, y_true, z_true, 'b', label='true helix')

        # red stars show distorted sample around a blue line
        ax3d.plot(x_sample, y_sample, z_sample, 'r*')
        # green line and dots show fitted curve
        ax3d.plot(x_knots, y_knots, z_knots, 'go')
        print ('x knots len = '+str(len(x_knots)))
        print ('y knots len = ' + str(len(y_knots)))
        print ('z knots len = ' + str(len(z_knots)))
        print ('x sample len = '+str(len(x_sample)))

        #for i in range(len(x_knots)):
        #    print ("    ["+str(x_knots[i]) + " " + str(y_knots[i]) + " " + str(z_knots[i]) + "]" )

        print ('x sample len = ' + str(len(x_sample)))

        ax3d.plot(x_sample, y_sample, z_sample, 'g')

        plt.show()
'''

'''
# 3D example
total_rad = 10
z_factor = 3
noise = 0.1

num_true_pts = 200
s_true = np.linspace(0, total_rad, num_true_pts)
x_true = np.cos(s_true)
y_true = np.sin(s_true)
z_true = s_true/z_factor

num_sample_pts = 100
s_sample = np.linspace(0, total_rad, num_sample_pts)
x_sample = np.cos(s_sample) + noise * np.random.randn(num_sample_pts)
y_sample = np.sin(s_sample) + noise * np.random.randn(num_sample_pts)
z_sample = s_sample/z_factor + noise * np.random.randn(num_sample_pts)

tck, u = interpolate.splprep([x_sample,y_sample,z_sample], s=2)
x_knots, y_knots, z_knots = interpolate.splev(tck[0], tck)
u_sample = np.linspace(0,1,num_true_pts)
x_sample, y_sample, z_sample = interpolate.splev(u_sample, tck)

fig2 = plt.figure(2)
ax3d = fig2.add_subplot(111, projection='3d')

# blue line shows true helix
ax3d.plot(x_true, y_true, z_true, 'b', label='true helix')

# red stars show distorted sample around a blue line
ax3d.plot(x_sample, y_sample, z_sample, 'r*')
# green line and dots show fitted curve
ax3d.plot(x_knots, y_knots, z_knots, 'go')
ax3d.plot(x_sample, y_sample, z_sample, 'g')
plt.show()
'''
